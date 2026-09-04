"use client";

import { exerciseImageUrl } from "@/lib/exercise-image-url";
import ExerciseImage from "@/components/ExerciseImage";
import ExercisePanels from "@/components/ExercisePanels";

// Re-exported for backwards compatibility with existing imports.
export { exerciseImageUrl };

export default function ImageLightbox({
  images,
  phases,
  title,
  onClose,
}: {
  images: string[];
  phases?: number | null;
  title: string;
  onClose: () => void;
}) {
  if (images.length === 0) return null;
  // A generated illustration is ONE wide plate with the movement phases as
  // panels inside it, so it gets the full width. Exercises still on the
  // free-exercise-db fallback hand us two separate start/end frames — those keep
  // sharing the row, otherwise the end position would be lost.
  const single = images.length === 1;
  const panels = single && phases && phases > 1 ? phases : 0;
  return (
    <div
      className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      {/* On a phone the plate is shown one panel at a time, stacked: a wide
          strip scaled into a 480px column leaves each panel too small to read
          the form off. On a wider screen the panels already have room, so the
          plate stays whole and the comparison between phases is direct. */}
      {panels > 0 && (
        <ExercisePanels
          src={images[0]}
          phases={panels}
          alt={title}
          className="flex w-full max-w-[90vw] flex-col gap-2 overflow-y-auto sm:hidden"
        />
      )}
      <div
        className={
          panels > 0
            ? "hidden sm:flex flex-col sm:flex-row gap-2 items-center justify-center w-full max-w-5xl"
            : "flex flex-col sm:flex-row gap-2 items-center justify-center w-full max-w-5xl"
        }
      >
        {images.map((img) => (
          <ExerciseImage
            key={img}
            src={img}
            // Only the single generated plate carries panels to number.
            phases={single ? phases ?? null : null}
            alt={title}
            className={
              single
                ? "rounded-lg object-contain min-w-0 max-h-[60vh] sm:max-h-[80vh] max-w-full"
                : "rounded-lg object-contain min-w-0 max-h-[38vh] sm:max-h-[70vh] max-w-[90vw] sm:max-w-[calc(50%-0.25rem)]"
            }
            numeralClassName="pl-2 pt-1.5 text-base"
          />
        ))}
      </div>
      <p className="text-white text-sm mt-3">{title}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 rounded-full bg-white/20 text-white px-4 py-1.5 text-sm"
      >
        Close
      </button>
    </div>
  );
}
