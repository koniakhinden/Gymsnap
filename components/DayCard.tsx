"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Repeat2,
  ChevronDown,
  BookOpen,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { exerciseImageUrl } from "@/lib/exercise-image-url";
import ExerciseLog from "@/components/ExerciseLog";
import RoutineItemRow from "@/components/RoutineItemRow";
import ExercisePicker, {
  type ExerciseOption,
  type PickedExercise,
} from "@/components/ExercisePicker";
import type { FullDay, SetLog } from "@/lib/plan-data";
import { fetchJson } from "@/lib/safe-fetch";
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
  exerciseOptions,
  optionsLoading = false,
  onMutated,
}: {
  day: FullDay;
  weightUnit: "kg" | "lbs";
  isOpen: boolean;
  onOpen: () => void;
  onDone: () => void;
  onImageClick: (images: string[], title: string) => void;
  exerciseOptions: ExerciseOption[];
  optionsLoading?: boolean;
  /** Reload the week after the user adds / changes / removes an exercise. */
  onMutated: () => void;
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

  // Sets saved during this session, keyed by entry. Lets a day that's closed and
  // reopened ("Continue logging") re-seed each log window with the weights/reps
  // just entered, before the next full week reload refreshes ex.logs from the DB.
  const [sessionLogs, setSessionLogs] = useState<Record<number, SetLog[]>>({});
  function logsFor(entryId: number, dbLogs: SetLog[]): SetLog[] {
    return sessionLogs[entryId] ?? dbLogs;
  }

  // Per-entry chosen alternative (index into that entry's `alternatives`), or
  // null for the original exercise. Seeded from the DB so a swap persists across
  // reloads. Logs stay attached to the entry, so swapping keeps the diary intact.
  const [swapIdx, setSwapIdx] = useState<Record<number, number | null>>(() =>
    Object.fromEntries(day.exercises.map((e) => [e.id, e.activeAltIndex ?? null]))
  );
  const [swappingId, setSwappingId] = useState<number | null>(null);
  const [swapErrorId, setSwapErrorId] = useState<number | null>(null);

  async function swapTo(entryId: number, altIndex: number | null) {
    const prev = swapIdx[entryId] ?? null;
    if (prev === altIndex) return;
    setSwappingId(entryId);
    setSwapErrorId(null);
    setSwapIdx((s) => ({ ...s, [entryId]: altIndex })); // optimistic
    try {
      await fetchJson(`/api/entries/${entryId}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altIndex }),
      });
    } catch {
      setSwapIdx((s) => ({ ...s, [entryId]: prev })); // roll back on failure
      setSwapErrorId(entryId);
    } finally {
      setSwappingId(null);
    }
  }

  // Manual add / change exercise picker. `add` targets this day; `change`
  // targets one entry. Null = closed.
  const [picker, setPicker] = useState<
    { mode: "add" } | { mode: "change"; entryId: number } | null
  >(null);
  const [mutating, setMutating] = useState(false);
  const [mutateError, setMutateError] = useState<string | null>(null);

  async function handlePick(sel: PickedExercise) {
    if (!picker) return;
    setMutating(true);
    setMutateError(null);
    try {
      if (picker.mode === "add") {
        await fetchJson(`/api/days/${day.id}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sel),
        });
      } else {
        await fetchJson(`/api/entries/${picker.entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sel),
        });
      }
      setPicker(null);
      onMutated();
    } catch (err) {
      setMutateError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setMutating(false);
    }
  }

  async function handleRemove(entryId: number, name: string) {
    if (!window.confirm(`Remove “${name}” from this day?`)) return;
    setMutating(true);
    setMutateError(null);
    try {
      await fetchJson(`/api/entries/${entryId}`, { method: "DELETE" });
      onMutated();
    } catch (err) {
      setMutateError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setMutating(false);
    }
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
          // Resolve the active variant: the swapped-in alternative if one is
          // chosen, otherwise the originally prescribed exercise. The sets/reps/
          // weight prescription always comes from the entry itself.
          const activeIdx = swapIdx[ex.id] ?? null;
          const activeAlt =
            activeIdx != null ? ex.alternatives[activeIdx] : undefined;
          const isSwapped = activeAlt != null;
          const originalName = ex.nameOverride ?? ex.exercise?.name ?? "Exercise";
          const name = activeAlt
            ? activeAlt.nameOverride ?? activeAlt.exercise?.name ?? "Alternative"
            : originalName;
          const images =
            (activeAlt ? activeAlt.exercise?.images : ex.exercise?.images) ?? [];
          const equipment = activeAlt
            ? activeAlt.exercise?.equipment
            : ex.exercise?.equipment;
          const equipmentLabel = formatEquipmentLabel(equipment);
          const isDumbbell = equipment === "dumbbell";
          const instructions =
            (activeAlt
              ? activeAlt.exercise?.instructions
              : ex.exercise?.instructions) ?? [];
          const isLogged = savedIds.has(ex.id);
          return (
            <div
              key={ex.id}
              className={cn(
                "exercise-row flex gap-3 border-t border-divider pt-2 first:border-t-0 first:pt-0",
                // Logged exercises get a green left stripe in the read view so a
                // selectively-completed day is easy to scan at a glance.
                !isOpen &&
                  isLogged &&
                  "rounded-l-sm border-l-[3px] border-l-success pl-2.5",
              )}
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
                    className="h-14 w-[84px] rounded-md border border-border object-cover"
                  />
                </button>
              )}
              <div className="flex-1 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    {name}
                    {isSwapped && <Badge tone="neutral">Swapped</Badge>}
                    {ex.unverified && <Badge tone="warning">Unverified</Badge>}
                  </p>
                  {equipmentLabel && (
                    <Badge tone="beta" className="shrink-0">
                      {equipmentLabel}
                    </Badge>
                  )}
                </div>
                <p className="text-ink-secondary">
                  {ex.sets} sets x {ex.reps} · {ex.weight || "bodyweight"}
                  {isDumbbell && ex.weight ? " per dumbbell" : ""} · rest {ex.restSec}s
                </p>
                {ex.notes && <p className="mt-0.5 text-xs text-ink-tertiary">{ex.notes}</p>}

                {/* "How to do it" (left) and occupied-equipment backups (right)
                    on one row with big tap targets, so the two small links don't
                    get mis-tapped. How-to prints; alternatives are no-print. */}
                {(instructions.length > 0 || ex.alternatives.length > 0) && (
                  <div className="mt-1 flex items-center justify-between gap-3">
                    {instructions.length > 0 ? (
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
                        Swap exercise ({ex.alternatives.length})
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

                {/* Expanded how-to steps (of the active variant). */}
                {openHow.has(ex.id) && instructions.length > 0 && (
                  <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-4 text-xs text-ink-secondary">
                    {instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}

                {/* Swap panel: pick a different movement for this slot. The choice
                    is saved and can be reverted; logs stay attached to the entry.
                    no-print keeps it out of the PDF. */}
                {openAlts.has(ex.id) && ex.alternatives.length > 0 && (
                  <div className="no-print mt-1 flex flex-col gap-2 rounded-field border border-divider bg-surface-sunken/40 p-2.5">
                    <ul className="flex flex-col gap-2">
                      {ex.alternatives.map((alt, i) => {
                        const altName =
                          alt.nameOverride ?? alt.exercise?.name ?? "Alternative";
                        const altEquip = formatEquipmentLabel(alt.exercise?.equipment);
                        const active = activeIdx === i;
                        return (
                          <li
                            key={i}
                            className="flex items-start justify-between gap-2 text-[13px]"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
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
                            </div>
                            <button
                              type="button"
                              disabled={swappingId === ex.id}
                              onClick={() => swapTo(ex.id, active ? null : i)}
                              className={cn(
                                "inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-btn border px-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50",
                                active
                                  ? "border-success/40 bg-success-bg text-success"
                                  : "border-border bg-surface text-accent hover:border-accent-border",
                              )}
                            >
                              {active ? (
                                <>
                                  <Check size={14} strokeWidth={2.5} /> In use
                                </>
                              ) : (
                                "Use this"
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {isSwapped && (
                      <button
                        type="button"
                        disabled={swappingId === ex.id}
                        onClick={() => swapTo(ex.id, null)}
                        className="inline-flex min-h-[36px] items-center gap-1 self-start text-[13px] font-semibold text-ink-secondary transition-colors hover:text-ink disabled:opacity-50"
                      >
                        <RotateCcw size={14} strokeWidth={2} />
                        Revert to {originalName}
                      </button>
                    )}

                    {swapErrorId === ex.id && (
                      <p className="text-[12px] text-error">
                        Couldn’t swap — check your connection and try again.
                      </p>
                    )}
                  </div>
                )}

                {/* Manual edit: replace this exercise or remove it. Kept out of
                    the PDF; the choice persists and logs stay attached. */}
                <div className="no-print mt-1 flex items-center gap-4">
                  <button
                    type="button"
                    disabled={mutating}
                    onClick={() => setPicker({ mode: "change", entryId: ex.id })}
                    className="inline-flex min-h-[36px] items-center gap-1 text-[13px] font-semibold text-ink-secondary transition-colors hover:text-accent disabled:opacity-50"
                  >
                    <Pencil size={13} strokeWidth={2} />
                    Change
                  </button>
                  <button
                    type="button"
                    disabled={mutating}
                    onClick={() => handleRemove(ex.id, name)}
                    className="inline-flex min-h-[36px] items-center gap-1 text-[13px] font-semibold text-ink-secondary transition-colors hover:text-error disabled:opacity-50"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                    Remove
                  </button>
                </div>

                {/* Read-only: show what was logged, if we have the set data.
                    (Sets saved earlier this session set the check icon above via
                    savedIds; their detail appears after the next reload.) */}
                {!isOpen && logsFor(ex.id, ex.logs).length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-tertiary">
                    <span className="font-medium">Logged:</span>{" "}
                    {formatLoggedSets(logsFor(ex.id, ex.logs))}
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
                    perDumbbell={isDumbbell}
                    initialLogs={logsFor(ex.id, ex.logs)}
                    onSavedChange={(saved) => markSaved(ex.id, saved)}
                    onSaved={(logs) => setSessionLogs((prev) => ({ ...prev, [ex.id]: logs }))}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add your own exercise to this day (muscle -> equipment -> exercise, or
          free-text). Kept out of the PDF. */}
      <button
        type="button"
        disabled={mutating}
        onClick={() => setPicker({ mode: "add" })}
        className="no-print mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-field border border-dashed border-border text-[13px] font-semibold text-accent transition-colors hover:border-accent-border hover:bg-accent-fill/40 disabled:opacity-50"
      >
        <Plus size={16} strokeWidth={2.5} />
        Add exercise
      </button>

      {mutateError && (
        <p className="no-print mt-1.5 text-[12px] text-error">{mutateError}</p>
      )}

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

      <ExercisePicker
        open={picker !== null}
        title={picker?.mode === "change" ? "Change exercise" : "Add exercise"}
        options={exerciseOptions}
        loading={optionsLoading}
        submitting={mutating}
        onClose={() => setPicker(null)}
        onPick={handlePick}
      />
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
