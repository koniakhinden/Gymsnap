"use client";

import ExerciseImage from "@/components/ExerciseImage";
import type { HydratedRoutineItem } from "@/lib/plan-data";

// One warmup or stretch move: optional thumbnail + name + duration + how-to.
export default function RoutineItemRow({
  item,
  onImageClick,
}: {
  item: HydratedRoutineItem;
  onImageClick?: (images: string[], title: string, phases: number | null) => void;
}) {
  const name = item.nameOverride ?? item.exercise?.name ?? "Movement";
  const images = item.exercise?.images ?? [];
  const how = item.howTo || item.exercise?.instructions?.[0] || "";
  return (
    <li className="flex gap-2.5">
      {images.length > 0 && (
        <button
          type="button"
          onClick={() => onImageClick?.(images, name, item.exercise?.imagePhases ?? null)}
          className="exercise-thumb shrink-0"
        >
          <ExerciseImage
            src={images[0]}
            phases={item.exercise?.imagePhases ?? null}
            alt={name}
            className="h-10 w-[60px] rounded-md border border-border object-cover"
            numeralClassName="pl-0.5 text-[8px]"
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
