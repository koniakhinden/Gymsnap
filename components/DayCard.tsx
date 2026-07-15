"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, Repeat2, ChevronDown, BookOpen } from "lucide-react";
import { exerciseImageUrl } from "@/components/ImageLightbox";
import ExerciseLog from "@/components/ExerciseLog";
import RoutineItemRow from "@/components/RoutineItemRow";
import type { FullDay, SetLog } from "@/lib/plan-data";
import { Button, Card, Badge, Stepper, cn } from "@/components/ui";

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

  // Which exercises have their alternatives list expanded (per exercise id).
  const [openAlts, setOpenAlts] = useState<Set<number>>(() => new Set());
  function toggleAlts(entryId: number) {
    setOpenAlts((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  // Which exercises have their "How to do it" steps expanded (per exercise id).
  const [openHow, setOpenHow] = useState<Set<number>>(() => new Set());
  function toggleHow(entryId: number) {
    setOpenHow((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

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
      <p className="mb-1 text-xs text-ink-tertiary">
        <span className="font-medium">Warmup:</span> {day.warmup}
      </p>
      {day.warmupItems.length > 0 && (
        <details className="no-print mb-3 text-xs" open>
          <summary className="cursor-pointer list-none font-medium text-accent hover:text-accent-hover">
            Warmup routine ({day.warmupItems.length})
          </summary>
          <ul className="mt-1.5 flex flex-col gap-2">
            {day.warmupItems.map((it, i) => (
              <RoutineItemRow key={i} item={it} onImageClick={onImageClick} />
            ))}
          </ul>
        </details>
      )}

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

                {/* "How to do it" (left) and occupied-equipment backups (right)
                    on one row with big tap targets, so the two small links don't
                    get mis-tapped. How-to prints; alternatives are no-print. */}
                {((ex.exercise?.instructions?.length ?? 0) > 0 ||
                  ex.alternatives.length > 0) && (
                  <div className="mt-1 flex items-center justify-between gap-3">
                    {(ex.exercise?.instructions?.length ?? 0) > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleHow(ex.id)}
                        aria-expanded={openHow.has(ex.id)}
                        className="inline-flex min-h-[36px] items-center gap-1 pr-4 text-[13px] font-semibold text-accent transition-colors hover:text-accent-hover"
                      >
                        <BookOpen size={14} strokeWidth={2} />
                        How to do it
                        <ChevronDown
                          size={14}
                          strokeWidth={2.5}
                          className={cn(
                            "transition-transform",
                            openHow.has(ex.id) && "rotate-180",
                          )}
                        />
                      </button>
                    ) : (
                      <span />
                    )}
                    {ex.alternatives.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleAlts(ex.id)}
                        aria-expanded={openAlts.has(ex.id)}
                        className="no-print inline-flex min-h-[36px] items-center gap-1 pl-4 text-[13px] font-semibold text-accent transition-colors hover:text-accent-hover"
                      >
                        <Repeat2 size={14} strokeWidth={2} />
                        If equipment is taken ({ex.alternatives.length})
                        <ChevronDown
                          size={14}
                          strokeWidth={2.5}
                          className={cn(
                            "transition-transform",
                            openAlts.has(ex.id) && "rotate-180",
                          )}
                        />
                      </button>
                    )}
                  </div>
                )}

                {/* Expanded how-to steps. */}
                {openHow.has(ex.id) && (ex.exercise?.instructions?.length ?? 0) > 0 && (
                  <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-4 text-xs text-ink-secondary">
                    {ex.exercise!.instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}

                {/* Expanded equipment-taken backups. no-print keeps them out of the PDF. */}
                {openAlts.has(ex.id) && ex.alternatives.length > 0 && (
                  <ul className="no-print mt-1 flex flex-col gap-1.5 rounded-field border border-divider bg-surface-sunken/40 p-2.5">
                    {ex.alternatives.map((alt, i) => {
                      const altName =
                        alt.nameOverride ?? alt.exercise?.name ?? "Alternative";
                      const altEquip = formatEquipmentLabel(alt.exercise?.equipment);
                      return (
                        <li key={i} className="text-[13px]">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-ink">{altName}</span>
                            {altEquip && (
                              <Badge tone="neutral" className="shrink-0">
                                {altEquip}
                              </Badge>
                            )}
                          </div>
                          {alt.note && (
                            <p className="text-xs text-ink-tertiary">{alt.note}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

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
        <>
          <p className="mt-3 text-xs text-ink-tertiary">
            <span className="font-medium">Cardio:</span> {day.cardio.type} for{" "}
            {day.cardio.durationMin} min
            {day.cardio.incline ? `, incline ${day.cardio.incline}` : ""}
            {day.cardio.targetHr ? `, target HR ${day.cardio.targetHr}` : ""}
          </p>
          {isOpen ? (
            <CardioLog
              dayId={day.id}
              prescribedMin={day.cardio.durationMin}
              initialMin={day.cardioActualMin}
            />
          ) : (
            day.cardioActualMin != null && (
              <p className="mt-1 text-xs text-accent">
                <CheckCircle2
                  size={13}
                  strokeWidth={2.5}
                  className="mb-0.5 mr-1 inline"
                />
                Cardio done: {day.cardioActualMin} min
              </p>
            )
          )}
        </>
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

/**
 * Cardio logger for a day. Separate from the strength set logs on purpose:
 * saving it never touches the "X/Y saved" exercise progress. It just records how
 * many minutes of cardio the user actually did, which the check-in uses to mark
 * a cardio-only day complete (≥20 min).
 */
function CardioLog({
  dayId,
  prescribedMin,
  initialMin,
}: {
  dayId: number;
  prescribedMin: number;
  initialMin: number | null;
}) {
  const [min, setMin] = useState<number>(initialMin ?? prescribedMin ?? 20);
  const [saved, setSaved] = useState(initialMin != null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/days/${dayId}/cardio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualMin: min }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save cardio.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="no-print mt-2 flex flex-col gap-1.5 rounded-field border border-accent-badge-border bg-accent-fill/50 p-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
        Cardio done (minutes)
      </span>
      <div className="flex items-center gap-2">
        <Stepper
          ariaLabel="cardio minutes done"
          value={min}
          min={0}
          max={300}
          step={5}
          onChange={(v) => {
            setMin(v);
            setSaved(false);
          }}
        />
        <Button
          onClick={save}
          loading={saving}
          variant={saved ? "secondary" : "primary"}
          className="!min-h-[44px] !px-4 !py-2 !text-sm"
        >
          {saving ? "Saving..." : saved ? "Saved" : "Save"}
        </Button>
      </div>
      {error && <p className="text-[13px] text-error">{error}</p>}
      <p className="text-[11px] text-ink-tertiary">
        Logged separately — doesn’t change your sets progress above.
      </p>
    </div>
  );
}
