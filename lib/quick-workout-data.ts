import { db } from "./db";
import { exercises, quickWorkouts } from "./db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { exerciseImageUrl, resolveImagesBatch } from "./exercise-images";
import type { QuickBlock, QuickWorkout } from "./validation/quick-workout";

export type HydratedBlock = QuickBlock & {
  exercise: {
    id: string;
    name: string;
    images: string[];
    equipment: string | null;
    instructions: string[];
  } | null;
};

export type HydratedQuickWorkout = Omit<QuickWorkout, "blocks"> & {
  blocks: HydratedBlock[];
};

/**
 * Attaches library exercise data (name, start/end images, equipment) to each
 * block that references a real exerciseId, so the result screen can show images
 * and an equipment badge.
 */
export async function hydrateQuickWorkout(
  workout: QuickWorkout
): Promise<HydratedQuickWorkout> {
  const ids = workout.blocks
    .map((b) => b.exerciseId)
    .filter((id): id is string => id !== null);

  // Library rows and generated illustrations in one round trip each — the
  // generated image wins for display, exercises.images stays untouched.
  const [rows, generatedImages] = await Promise.all([
    ids.length > 0
      ? db.select().from(exercises).where(inArray(exercises.id, ids))
      : Promise.resolve([] as (typeof exercises.$inferSelect)[]),
    resolveImagesBatch(ids),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));

  return {
    ...workout,
    blocks: workout.blocks.map((b) => {
      const ex = b.exerciseId ? byId.get(b.exerciseId) : undefined;
      const generated = ex ? generatedImages.get(ex.id) : undefined;
      return {
        ...b,
        exercise: ex
          ? {
              id: ex.id,
              name: ex.name,
              images: generated ? [generated] : ex.images.map(exerciseImageUrl),
              equipment: ex.equipment,
              instructions: ex.instructions,
            }
          : null,
      };
    }),
  };
}

export type QuickWorkoutHistoryItem = {
  id: number;
  createdAt: string;
  equipmentMode: "saved" | "photo" | "none";
  equipment: { name: string; category: string }[];
  sessionType: QuickWorkout["sessionType"];
  focusChips: string[];
  focusText: string;
  timeMin: number;
  title: string;
  focus: string;
};

/** Last N quick workouts for a user, newest first — inputs plus title/focus. */
export async function getRecentQuickWorkouts(
  userId: string,
  limit = 5
): Promise<QuickWorkoutHistoryItem[]> {
  const rows = await db
    .select()
    .from(quickWorkouts)
    .where(eq(quickWorkouts.userId, userId))
    .orderBy(desc(quickWorkouts.id))
    .limit(limit);

  return rows.map((row) => {
    const result = row.result as QuickWorkout;
    return {
      id: row.id,
      createdAt: row.createdAt,
      equipmentMode: row.equipmentMode,
      equipment: row.equipment,
      sessionType: result?.sessionType ?? "strength",
      focusChips: row.focusChips,
      focusText: row.focusText,
      timeMin: row.timeMin,
      title: result?.title ?? "Quick workout",
      focus: result?.focus ?? "",
    };
  });
}
