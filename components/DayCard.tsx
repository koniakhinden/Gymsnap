"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { exerciseImageUrl } from "@/components/ImageLightbox";
import ExerciseLog from "@/components/ExerciseLog";
import type { FullDay, SetLog } from "@/lib/plan-data";
import { Button, Card, Badge } from "@/components/ui";

const EQUIPMENT_LABELS: Record<string, string> = {
  "body only": "Bodyweight",
  cable: "Cable station",
  machine: "Machine",
  dumbbell: "Dumbbells",
  barbell: "Barbell",
  kettlebells: "Kettlebell",
  "medicine ball": "Medicine ball",
  "exercise ball": "Exercise ball",
  bands: "Band",
  "e-z curl bar": "EZ bar",
  "foam roll": "Foam roller",
  other: "Other",
};

function formatEquipmentLabel(equipment: string | null | undefined): string | null {
  if (!equipment) return null;
  return EQUIPMENT_LABELS[equipment] ?? equipment;
}

/** Compact one-line summary of what was logged, for the read-only view. */
function formatLoggedSets(logs: SetLog[]): string {
  return [...logs]
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((l) => {
      const w = l.weight != null ? `${l.weight}${l.weightUnit}` : "bw";
      const r = l.toFailure ? "AMRAP" : l.reps != null ? l.reps : "?";
      return `${w}×${r}`;
    })
    .join(", ");
}

export default function DayCard({
  day,
  weightUnit,
  isOpen,
  onOpen,
  onDone,
  onImageClick,
}: {
  day: FullDay;
  weightUnit: "kg" | "lbs";
  isOpen: boolean;
  onOpen: () => void;
  onDone: () => void;
  onImageClick: (images: string[], title: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const total = day.exercises.length;

  // Which entries have saved logs. Seeded from what's already in the DB so the
  // progress and "Done" badge are correct on first render.
  const [savedIds, setSavedIds] = useState<Set<number>>(
    () => new Set(day.exercises.filter((e) => e.logs.length > 0).map((e) => e.id))
  );
  const loggedCount = savedIds.size;

  function markSaved(entryId: number, saved: boolean) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(entryId);
      else next.delete(entryId);
      return next;
    });
  }

  // Auto-scroll the day into view when it becomes the open (fill) day.
  useEffect(() => {
    if (isOpen) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isOpen]);

  return (
    <div ref={cardRef} className="day-card scroll-mt-4">
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold">{day.dayLabel}</h2>
        <div className="flex items-center gap-1.5">
          {loggedCount > 0 && (
            <Badge tone={loggedCount === total ? "success" : "neutral"}>
              {loggedCount === total ? "Done" : `${loggedCount}/${total}`}
            </Badge>
          )}
          {day.checkinStatus && (
            <Badge
              tone={
                day.checkinStatus === "completed"
                  ? "success"
                  : day.checkinStatus === "partial"
                    ? "warning"
                    : "neutral"
              }
            >
              {day.checkinStatus}
            </Badge>
          )}
        </div>
      </div>
      <p className="mb-2 text-sm text-ink-secondary">{day.focus}</p>
      <p className="mb-3 text-xs text-ink-tertiary">
        <span className="font-medium">Warmup:</span> {day.warmup}
      </p>

      {isOpen && (
        <p className="no-print mb-2 text-[13px] font-medium text-accent">
          Logging — {loggedCount}/{total} exercises saved
        </p>
      )}

      <div className="flex flex-col gap-2">
        {day.exercises.map((ex) => {
          const name = ex.nameOverride ?? ex.exercise?.name ?? "Exercise";
          const images = ex.exercise?.images ?? [];
          const equipmentLabel = formatEquipmentLabel(ex.exercise?.equipment);
          const isLogged = savedIds.has(ex.id);
          return (
            <div
              key={ex.id}
              className="exercise-row flex gap-3 border-t border-divider pt-2 first:border-t-0 first:pt-0"
            >
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => onImageClick(images, name)}
                  className="exercise-thumb shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={exerciseImageUrl(images[0])}
                    alt={name}
                    className="h-14 w-14 rounded-md border border-border object-cover"
                  />
                </button>
              )}
              <div className="flex-1 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    {name}
                    {ex.unverified && <Badge tone="warning">Unverified</Badge>}
                    {!isOpen && isLogged && (
                      <CheckCircle2 size={15} strokeWidth={2.5} className="text-success" />
                    )}
                  </p>
                  {equipmentLabel && (
                    <Badge tone="beta" className="shrink-0">
                      {equipmentLabel}
                    </Badge>
                  )}
                </div>
                <p className="text-ink-secondary">
                  {ex.sets} sets x {ex.reps} · {ex.weight || "bodyweight"} · rest {ex.restSec}s
                </p>
                {ex.notes && <p className="mt-0.5 text-xs text-ink-tertiary">{ex.notes}</p>}

                {/* Read-only: show what was logged, if we have the set data.
                    (Sets saved earlier this session set the check icon above via
                    savedIds; their detail appears after the next reload.) */}
                {!isOpen && ex.logs.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-tertiary">
                    <span className="font-medium">Logged:</span> {formatLoggedSets(ex.logs)}
                  </p>
                )}
                {isOpen && (
                  <ExerciseLog
                    embedded
                    entryId={ex.id}
                    plannedSets={ex.sets}
                    plannedReps={ex.reps}
                    plannedWeight={ex.weight}
                    weightUnit={weightUnit}
                    initialLogs={ex.logs}
                    onSavedChange={(saved) => markSaved(ex.id, saved)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {day.cardio && (
        <p className="mt-3 text-xs text-ink-tertiary">
          <span className="font-medium">Cardio:</span> {day.cardio.type} for{" "}
          {day.cardio.durationMin} min
          {day.cardio.incline ? `, incline ${day.cardio.incline}` : ""}
          {day.cardio.targetHr ? `, target HR ${day.cardio.targetHr}` : ""}
        </p>
      )}

      <p className="mt-2 text-xs text-ink-tertiary">
        <span className="font-medium">Cooldown:</span> {day.cooldown}
      </p>

      {/* Fill / read-only switch. In fill mode the Done bar is sticky so it stays
          reachable while scrolling a long day. A cardio-only day has no exercise
          entries to log, so we skip the logging control entirely there. */}
      {total === 0 ? null : !isOpen ? (
        <Button
          block
          className="no-print mt-3"
          variant={loggedCount > 0 ? "secondary" : "primary"}
          onClick={onOpen}
        >
          <ClipboardList size={16} strokeWidth={2} />
          {loggedCount > 0 ? "Continue logging" : "Fill workout"}
        </Button>
      ) : (
        <div className="no-print sticky bottom-2 z-10 mt-3 flex items-center justify-between gap-3 rounded-btn border border-border bg-surface/95 p-2 pl-3 backdrop-blur">
          <span className="text-[13px] font-medium text-ink-secondary">
            {loggedCount}/{total} saved
          </span>
          <Button variant="primary" className="!min-h-[44px] !px-5" onClick={onDone}>
            Done
          </Button>
        </div>
      )}
    </Card>
    </div>
  );
}
