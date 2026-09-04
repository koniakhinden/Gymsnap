"use client";

import { exerciseImageUrl } from "@/lib/exercise-image-url";
import { cn } from "@/components/ui";

/**
 * An exercise illustration with its phase numbers drawn on top.
 *
 * The generated plates deliberately contain no numerals — the model rendered
 * them inconsistently, and drawing them here means they land in the design
 * system's own font. Panels are equal width, so panel i starts at i/phases of
 * the image and the positions follow from `phases` alone.
 *
 * `phases` is null for exercises still on the free-exercise-db photo fallback,
 * which are separate frames with no panels to number.
 */
export default function ExerciseImage({
  src,
  phases,
  alt,
  className,
  numeralClassName,
}: {
  src: string;
  phases: number | null;
  alt: string;
  className?: string;
  numeralClassName?: string;
}) {
  const panels = phases && phases > 1 ? phases : 0;
  return (
    <span className="exercise-image relative block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={exerciseImageUrl(src)} alt={alt} className={className} />
      {panels > 0 &&
        Array.from({ length: panels }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              "exercise-panel-num absolute top-0 font-semibold leading-none text-ink",
              numeralClassName
            )}
            style={{ left: `${(i * 100) / panels}%` }}
          >
            {i + 1}
          </span>
        ))}
    </span>
  );
}
