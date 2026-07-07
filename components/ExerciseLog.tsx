"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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
}: {
  entryId: number;
  plannedSets: number;
  plannedReps: string;
  plannedWeight: string;
  weightUnit: Unit;
  initialLogs: SetLog[];
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

  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState<SetEntry[]>(buildInitial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initialLogs.length > 0);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<SetEntry>) {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    setSaved(false);
  }

  function copyToAll() {
    setSets((prev) => (prev.length ? prev.map(() => ({ ...prev[0] })) : prev));
    setSaved(false);
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
    <div className="no-print mt-2 flex flex-col gap-2 rounded-field border border-divider bg-surface-sunken/40 p-2.5">
      {sets.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="w-11 shrink-0 text-[13px] font-medium text-ink-tertiary">
            Set {i + 1}
          </span>

          <Stepper
            ariaLabel={`set ${i + 1} weight`}
            value={s.weight}
            min={0}
            step={weightStep}
            suffix={weightUnit}
            onChange={(v) => update(i, { weight: v })}
          />

          <Stepper
            ariaLabel={`set ${i + 1} reps`}
            value={s.reps}
            min={REP_MIN}
            max={REP_MAX}
            step={1}
            suffix="reps"
            onChange={(v) => update(i, { reps: v })}
          />

          <button
            type="button"
            aria-pressed={s.toFailure}
            onClick={() => update(i, { toFailure: !s.toFailure })}
            className={cn(
              "inline-flex min-h-[36px] select-none items-center rounded-pill border px-3 text-[13px] font-medium transition-colors",
              s.toFailure
                ? "border-accent-border bg-accent-fill text-accent-hover"
                : "border-border bg-surface text-ink-tertiary hover:border-ink-disabled",
            )}
          >
            To failure
          </button>
        </div>
      ))}

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
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto min-h-[44px] px-2 text-[13px] font-medium text-ink-tertiary hover:text-ink-secondary"
        >
          Close
        </button>
      </div>
    </div>
  );
}
