import { db } from "./db";
import { exercises, quickWorkouts } from "./db/schema";
import { desc, inArray } from "drizzle-orm";
import type { QuickBlock, QuickWorkout } from "./validation/quick-workout";

export type HydratedBlock = QuickBlock & {
  exercise: {
    id: string;
    name: string;
    images: string[];
    equipment: string | null;
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

  const rows =
    ids.length > 0
      ? await db.select().from(exercises).where(inArray(exercises.id, ids))
      : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  return {
    ...workout,
    blocks: workout.blocks.map((b) => {
      const ex = b.exerciseId ? byId.get(b.exerciseId) : undefined;
      return {
        ...b,
        exercise: ex
          ? {
              id: ex.id,
              name: ex.name,
              images: ex.images,
              equipment: ex.equipment,
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
  focusChips: string[];
  focusText: string;
  timeMin: number;
  title: string;
  focus: string;
};

/** Last N quick workouts, newest first — inputs plus a title/focus for the list. */
export async function getRecentQuickWorkouts(
  limit = 5
): Promise<QuickWorkoutHistoryItem[]> {
  const rows = await db
    .select()
    .from(quickWorkouts)
    .orderBy(desc(quickWorkouts.id))
    .limit(limit);

  return rows.map((row) => {
    const result = row.result as QuickWorkout;
    return {
      id: row.id,
      createdAt: row.createdAt,
      equipmentMode: row.equipmentMode,
      equipment: row.equipment,
      focusChips: row.focusChips,
      focusText: row.focusText,
      timeMin: row.timeMin,
      title: result?.title ?? "Quick workout",
      focus: result?.focus ?? "",
    };
  });
}
