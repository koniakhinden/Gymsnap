// Client-safe half of lib/exercise-images.ts.
//
// The URL helper is used by "use client" components (DayCard, RoutineItemRow,
// ImageLightbox, Train now), so it cannot live in a module that imports lib/db —
// that would pull @neondatabase/serverless into the browser bundle and throw on
// the missing DATABASE_URL. lib/exercise-images.ts re-exports this, so server
// code can keep importing everything from one place.

const FREEDB_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

/**
 * Replaces the previous exerciseImageUrl(). Absolute URLs (our Blob) pass
 * through as-is; relative free-exercise-db paths get the GitHub prefix.
 */
export function exerciseImageUrl(raw: string): string {
  return /^https?:\/\//.test(raw) ? raw : FREEDB_BASE + raw;
}
