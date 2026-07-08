"use client";

import { useState } from "react";
import { Check, Flame } from "lucide-react";
import type { SetLog } from "@/lib/plan-data";
import { Button, Stepper, cn } from "@/components/ui";

type Unit = "kg" | "lbs";

type SetEntry = {
  // Kept as a number for the stepper; 0 is stored as null (bodyweight) on save.
  weight: number;
  reps: number;
  toFailure: boolean;
};

const REP_MIN = 1;
const REP_MAX = 50;

/** Pull the first integer out of a plan reps string ("10-15" → 12, "12" → 12). */
function parsePlannedReps(reps: string): { reps: number; toFailure: boolean } {
  const lower = reps.toLowerCase();
  const toFailure = lower.includes("fail") || lower.includes("amrap") || lower.includes("max");
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length >= 2) return { reps: Math.round((nums[0] + nums[1]) / 2), toFailure };
  if (nums.length === 1) return { reps: nums[0], toFailure };
  return { reps: 10, toFailure };
}

/** Parse a plan weight string into a number, or null for bodyweight. */
function parsePlannedWeight(weight: string): number | null {
  if (!weight) return null;
  const lower = weight.toLowerCase();
  if (lower.includes("body") || lower.includes("bw")) return null;
  const m = weight.match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export default function ExerciseLog({
  entryId,
  plannedSets,
  plannedReps,
  plannedWeight,
  weightUnit,
  initialLogs,
  embedded = false,
  onSavedChange,
}: {
  entryId: number;
  plannedSets: number;
  plannedReps: string;
  plannedWeight: string;
  weightUnit: Unit;
  initialLogs: SetLog[];
  // Embedded in a day's "Fill workout" mode: always open, no self-toggle/close,
  // and reports its saved state up so the day can show X/Y progress.
  embedded?: boolean;
  onSavedChange?: (saved: boolean) => void;
}) {
  const weightStep = weightUnit === "kg" ? 2.5 : 5;
  const planned = parsePlannedReps(plannedReps);
  const plannedW = parsePlannedWeight(plannedWeight); // null = bodyweight in the plan

  function buildInitial(): SetEntry[] {
    if (initialLogs.length > 0) {
      return [...initialLogs]
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((l) => ({
          weight: l.weight ?? 0,
          reps: l.reps ?? planned.reps,
          toFailure: l.toFailure,
        }));
    }
    return Array.from({ length: Math.max(1, plannedSets) }, () => ({
      weight: plannedW ?? 0,
      reps: planned.reps,
      toFailure: planned.toFailure,
    }));
  }

  const [open, setOpen] = useState(embedded);
  const [sets, setSets] = useState<SetEntry[]>(buildInitial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initialLogs.length > 0);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<SetEntry>) {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    setSaved(false);
    onSavedChange?.(false);
  }

  function copyToAll() {
    setSets((prev) => (prev.length ? prev.map(() => ({ ...prev[0] })) : prev));
    setSaved(false);
    onSavedChange?.(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          weightUnit,
          loggedAt: new Date().toISOString(),
          sets: sets.map((s, i) => ({
            setNumber: i + 1,
            weight: s.weight > 0 ? s.weight : null,
            reps: s.reps,
            toFailure: s.toFailure,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setSaved(true);
      onSavedChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print mt-1 inline-flex min-h-[36px] items-center gap-1.5 text-[13px] font-semibold text-accent transition-colors hover:text-accent-hover"
      >
        {saved ? (
          <>
            <Check size={15} strokeWidth={2.5} /> Logged — edit
          </>
        ) : (
          "+ Log what you did"
        )}
      </button>
    );
  }

  return (
    <div className="no-print mt-2 flex flex-col gap-1.5 rounded-field border border-divider bg-surface-sunken/40 p-2.5">
      <div className="flex items-center gap-1.5 pl-6 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
        <span className="min-w-[112px]">Weight, {weightUnit}</span>
        <span className="min-w-[112px]">Reps</span>
      </div>

      {sets.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-4 shrink-0 text-[12px] font-semibold text-ink-tertiary tabular-nums">
            {i + 1}
          </span>

          <Stepper
            compact
            ariaLabel={`set ${i + 1} weight`}
            value={s.weight}
            min={0}
            step={weightStep}
            onChange={(v) => update(i, { weight: v })}
          />

          <Stepper
            compact
            ariaLabel={`set ${i + 1} reps`}
            value={s.reps}
            min={REP_MIN}
            max={REP_MAX}
            step={1}
            disabled={s.toFailure}
            onChange={(v) => update(i, { reps: v })}
          />

          <button
            type="button"
            aria-pressed={s.toFailure}
            aria-label="To failure"
            title="To failure"
            onClick={() => update(i, { toFailure: !s.toFailure })}
            className={cn(
              "flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-btn border transition-colors",
              s.toFailure
                ? "border-accent-border bg-accent-fill text-accent"
                : "border-border bg-surface text-ink-tertiary hover:border-ink-disabled",
            )}
          >
            <Flame size={16} strokeWidth={2} />
          </button>
        </div>
      ))}

      <p className="pl-6 text-[11px] text-ink-tertiary">
        <Flame size={11} strokeWidth={2} className="mb-0.5 mr-0.5 inline" />
        = to failure · 0 {weightUnit} = bodyweight
      </p>

      {error && <p className="text-[13px] text-error">{error}</p>}

      <div className="flex items-center gap-2 pt-0.5">
        <Button
          onClick={save}
          loading={saving}
          variant={saved ? "secondary" : "primary"}
          className="!min-h-[44px] !px-4 !py-2 !text-sm"
        >
          {saving ? "Saving..." : saved ? "Saved" : "Save"}
        </Button>
        {sets.length > 1 && (
          <button
            type="button"
            onClick={copyToAll}
            className="min-h-[44px] px-2 text-[13px] font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            Copy set 1 to all
          </button>
        )}
        {!embedded && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto min-h-[44px] px-2 text-[13px] font-medium text-ink-tertiary hover:text-ink-secondary"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
