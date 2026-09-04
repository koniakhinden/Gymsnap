// lib/exercise-images.ts
// Server-side read path for exercise images. A generated image wins over
// free-exercise-db, but exercises.images is never rewritten — the fallback is
// always there.
//
// The exerciseImageUrl() helper lives in ./exercise-image-url so client
// components can import it without dragging lib/db into the browser bundle;
// it is re-exported here so this module stays the single documented entry point.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { exerciseImages } from "./db/schema";

export { exerciseImageUrl } from "./exercise-image-url";
import { exerciseImageUrl } from "./exercise-image-url";

export interface ResolvedImages {
  urls: string[];
  source: "generated" | "freedb";
}

/** For a single exercise. `fallback` is the contents of exercises.images. */
export async function resolveImages(
  exerciseId: string,
  fallback: string[] | null | undefined,
): Promise<ResolvedImages> {
  const [row] = await db
    .select({ url: exerciseImages.url })
    .from(exerciseImages)
    .where(
      and(
        eq(exerciseImages.exerciseId, exerciseId),
        eq(exerciseImages.status, "active"),
      ),
    )
    .limit(1);

  if (row) return { urls: [row.url], source: "generated" };
  return { urls: (fallback ?? []).map(exerciseImageUrl), source: "freedb" };
}

/**
 * Batch for the plan page: one query instead of N.
 * Returns a map exerciseId → url, only for those with an active image.
 */
export async function resolveImagesBatch(
  exerciseIds: string[],
): Promise<Map<string, string>> {
  if (exerciseIds.length === 0) return new Map();

  const rows = await db
    .select({ id: exerciseImages.exerciseId, url: exerciseImages.url })
    .from(exerciseImages)
    .where(
      and(
        inArray(exerciseImages.exerciseId, exerciseIds),
        eq(exerciseImages.status, "active"),
      ),
    );

  return new Map(rows.map((r) => [r.id, r.url]));
}

/** One exercise's gallery: active + history, for admin/review. */
export async function listImageVersions(exerciseId: string) {
  return db
    .select()
    .from(exerciseImages)
    .where(eq(exerciseImages.exerciseId, exerciseId))
    .orderBy(exerciseImages.version);
}
