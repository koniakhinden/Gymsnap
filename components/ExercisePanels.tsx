"use client";

import { exerciseImageUrl } from "@/lib/exercise-image-url";

/**
 * One generated plate shown as its panels, stacked.
 *
 * A plate is a wide strip — 2048x1024 for a two-phase horizontal movement — so
 * in the app's 480px column each panel ends up a couple of hundred pixels wide
 * and the form is unreadable. Stacking the panels vertically gives each one the
 * full column width instead.
 *
 * No re-generation and no extra files: the panels are equal width by
 * construction, so each slice is the same image at `phases * 100%` width pushed
 * left by whole container widths. That also means the browser downloads and
 * decodes the plate once, and the slices cost nothing.
 *
 * `max-w-none` is load-bearing — Tailwind's preflight caps images at 100% and
 * would otherwise squash the over-wide image back into the container.
 */
export default function ExercisePanels({
  src,
  phases,
  alt,
  className,
}: {
  src: string;
  phases: number;
  alt: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: phases }, (_, i) => (
        <div
          key={i}
          className="relative w-full overflow-hidden rounded-lg border border-border bg-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={exerciseImageUrl(src)}
            // Only the first slice carries the label; the rest are the same
            // picture and would just repeat it to a screen reader.
            alt={i === 0 ? alt : ""}
            className="block max-w-none"
            style={{ width: `${phases * 100}%`, marginLeft: `-${i * 100}%` }}
          />
          <span
            aria-hidden="true"
            className="exercise-panel-num absolute left-0 top-0 pl-2 pt-1.5 text-base font-semibold leading-none text-ink"
          >
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}
