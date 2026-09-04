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
import { exerciseImageSpecs, exerciseImages } from "./db/schema";

export { exerciseImageUrl } from "./exercise-image-url";
import { exerciseImageUrl } from "./exercise-image-url";

/** An active generated illustration. `phases` is the panel count from the spec,
 *  needed to draw the panel numerals over the image (they are deliberately not
 *  drawn inside it). It is null for a manually supplied image with no spec. */
export interface GeneratedImage {
  url: string;
  phases: number | null;
}

export interface ResolvedImages {
  urls: string[];
  source: "generated" | "freedb";
  phases: number | null;
}

/** For a single exercise. `fallback` is the contents of exercises.images. */
export async function resolveImages(
  exerciseId: string,
  fallback: string[] | null | undefined,
): Promise<ResolvedImages> {
  const [row] = await db
    .select({ url: exerciseImages.url, phases: exerciseImageSpecs.phases })
    .from(exerciseImages)
    .leftJoin(
      exerciseImageSpecs,
      eq(exerciseImageSpecs.exerciseId, exerciseImages.exerciseId),
    )
    .where(
      and(
        eq(exerciseImages.exerciseId, exerciseId),
        eq(exerciseImages.status, "active"),
      ),
    )
    .limit(1);

  if (row) return { urls: [row.url], source: "generated", phases: row.phases };
  return {
    urls: (fallback ?? []).map(exerciseImageUrl),
    source: "freedb",
    phases: null,
  };
}

/**
 * Batch for the plan page: one query instead of N.
 * Returns a map exerciseId → url, only for those with an active image.
 */
export async function resolveImagesBatch(
  exerciseIds: string[],
): Promise<Map<string, GeneratedImage>> {
  if (exerciseIds.length === 0) return new Map();

  const rows = await db
    .select({
      id: exerciseImages.exerciseId,
      url: exerciseImages.url,
      phases: exerciseImageSpecs.phases,
    })
    .from(exerciseImages)
    .leftJoin(
      exerciseImageSpecs,
      eq(exerciseImageSpecs.exerciseId, exerciseImages.exerciseId),
    )
    .where(
      and(
        inArray(exerciseImages.exerciseId, exerciseIds),
        eq(exerciseImages.status, "active"),
      ),
    );

  return new Map(rows.map((r) => [r.id, { url: r.url, phases: r.phases }]));
}

/** One exercise's gallery: active + history, for admin/review. */
export async function listImageVersions(exerciseId: string) {
  return db
    .select()
    .from(exerciseImages)
    .where(eq(exerciseImages.exerciseId, exerciseId))
    .orderBy(exerciseImages.version);
}
