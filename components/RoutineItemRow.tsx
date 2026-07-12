"use client";

import { exerciseImageUrl } from "@/components/ImageLightbox";
import type { HydratedRoutineItem } from "@/lib/plan-data";

// One warmup or stretch move: optional thumbnail + name + duration + how-to.
export default function RoutineItemRow({
  item,
  onImageClick,
}: {
  item: HydratedRoutineItem;
  onImageClick?: (images: string[], title: string) => void;
}) {
  const name = item.nameOverride ?? item.exercise?.name ?? "Movement";
  const images = item.exercise?.images ?? [];
  const how = item.howTo || item.exercise?.instructions?.[0] || "";
  return (
    <li className="flex gap-2.5">
      {images.length > 0 && (
        <button
          type="button"
          onClick={() => onImageClick?.(images, name)}
          className="exercise-thumb shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={exerciseImageUrl(images[0])}
            alt={name}
            className="h-10 w-10 rounded-md border border-border object-cover"
          />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">
          {name}
          {item.duration && (
            <span className="ml-1 font-normal text-ink-tertiary">· {item.duration}</span>
          )}
        </p>
        {how && <p className="text-xs text-ink-tertiary">{how}</p>}
      </div>
    </li>
  );
}
