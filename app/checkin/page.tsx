"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FullWeek } from "@/lib/plan-data";
import {
  Button,
  buttonClass,
  Card,
  Field,
  Textarea,
  Slider,
  Skeleton,
  SkeletonCardRow,
} from "@/components/ui";
import { cn } from "@/components/ui/cn";

type DayStatus = "completed" | "partial" | "skipped";

// Per-status labels and the colour used when that status is selected.
const STATUS_META: Record<DayStatus, { label: string; on: string }> = {
  completed: { label: "Completed", on: "bg-success-bg text-success" },
  partial: { label: "Partial", on: "bg-warning-bg text-warning-ink" },
  skipped: { label: "Skipped", on: "bg-error-bg text-error" },
};
const STATUS_ORDER: DayStatus[] = ["completed", "partial", "skipped"];

// A day counts as "done on cardio alone" when the user logged at least this many
// cardio minutes and did no strength work.
const CARDIO_COMPLETE_MIN = 20;

/**
 * Default a day's status from what the user actually logged:
 *   all strength exercises logged → "completed"
 *   some strength logged          → "partial"
 *   no strength, cardio ≥ 20 min  → "completed" (cardio-only day counts as full)
 *   no strength, some cardio      → "partial"
 *   nothing logged at all         → "skipped" (don't pretend it was done)
 * The user can still change any of these.
 */
function deriveStatusFromLogs(d: FullWeek["days"][number]): DayStatus {
  const total = d.exercises.length;
  const logged = d.exercises.filter((e) => e.logs.length > 0).length;
  const cardioMin = d.cardioActualMin ?? 0;

  if (total > 0 && logged === total) return "completed";
  if (logged > 0) return "partial";
  if (cardioMin >= CARDIO_COMPLETE_MIN) return "completed";
  if (cardioMin > 0) return "partial";
  return "skipped";
}

export default function CheckinPage() {
  const router = useRouter();
  const [week, setWeek] = useState<FullWeek | null | undefined>(undefined);
  const [statuses, setStatuses] = useState<Record<number, DayStatus>>({});
  const [comment, setComment] = useState("");
  const [wellbeing, setWellbeing] = useState(3);
  const [knees, setKnees] = useState(3);
  const [lowerBack, setLowerBack] = useState(3);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plan")
      .then((res) => res.json())
      .then((data: { week: FullWeek | null }) => {
        setWeek(data.week);
        if (data.week) {
          const initial: Record<number, DayStatus> = {};
          for (const d of data.week.days) {
            // Saved status wins; otherwise derive from what was logged:
            // any exercise logged → at least "partial", all logged → "completed".
            initial[d.id] =
              (d.checkinStatus as DayStatus) ?? deriveStatusFromLogs(d);
          }
          setStatuses(initial);
          if (data.week.checkin) {
            setComment(data.week.checkin.overallComment ?? "");
            setWellbeing(data.week.checkin.wellbeing);
            setKnees(data.week.checkin.kneesRating);
            setLowerBack(data.week.checkin.lowerBackRating);
            setSaved(true);
          }
        }
      });
  }, []);

  async function handleSave() {
    if (!week) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId: week.id,
          overallComment: comment,
          wellbeing,
          kneesRating: knees,
          lowerBackRating: lowerBack,
          days: week.days.map((d) => ({ dayId: d.id, status: statuses[d.id] ?? "completed" })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save check-in.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateNext() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate next week.");
      router.push("/plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setGenerating(false);
    }
  }

  if (week === undefined) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <SkeletonCardRow />
        <SkeletonCardRow />
      </main>
    );
  }

  if (!week) {
    return (
      <main className="flex flex-col gap-3 p-4">
        <h1 className="text-xl font-bold">No week to check in on yet</h1>
        <Link href="/plan" className={buttonClass({ block: true, size: "lg" })}>
          Get exercise suggestions
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-bold">Check in — Week {week.weekNumber}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Tell GymSnap how the week went so next week can adjust.
        </p>
      </header>

      {error && (
        <div className="rounded-field border border-error/20 bg-error-bg p-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {week.days.map((d) => {
          const logged = d.exercises.filter((e) => e.logs.length > 0);
          return (
            <Card key={d.id} className="p-3">
              <p className="mb-2 text-sm font-medium">
                {d.dayLabel} — {d.focus}
              </p>
              <StatusControl
                value={statuses[d.id] ?? "completed"}
                onChange={(s) => setStatuses((prev) => ({ ...prev, [d.id]: s }))}
              />
              {logged.length > 0 && (
                <div className="mt-2.5 border-t border-divider pt-2">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
                    You logged
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {logged.map((e) => (
                      <li key={e.id} className="text-[13px] text-ink-secondary">
                        <span className="font-medium text-ink">
                          {e.nameOverride ?? e.exercise?.name ?? "Exercise"}
                        </span>
                        {"  "}
                        {e.logs
                          .slice()
                          .sort((a, b) => a.setNumber - b.setNumber)
                          .map((l) => {
                            const load =
                              l.weight != null ? `${l.weight}${l.weightUnit}` : "BW";
                            const reps = l.toFailure
                              ? "to failure"
                              : l.reps != null
                                ? `${l.reps}`
                                : "?";
                            return `${load}×${reps}`;
                          })
                          .join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Field label="Comments">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Anything felt off? Any wins?"
          rows={3}
        />
      </Field>

      <RatingSlider label={`Overall wellbeing: ${wellbeing}/5`} value={wellbeing} onChange={setWellbeing} />
      <RatingSlider label={`Knees: ${knees}/5`} value={knees} onChange={setKnees} />
      <RatingSlider label={`Lower back: ${lowerBack}/5`} value={lowerBack} onChange={setLowerBack} />

      <Button
        variant={saved ? "secondary" : "primary"}
        size="lg"
        block
        loading={saving}
        onClick={handleSave}
      >
        {saving ? "Saving..." : saved ? "Update check-in" : "Save check-in"}
      </Button>

      {saved && (
        <Button size="lg" block loading={generating} onClick={handleGenerateNext}>
          {generating ? "Generating..." : `Suggest exercises for week ${week.weekNumber + 1}`}
        </Button>
      )}
    </main>
  );
}

// Completed / Partial / Skipped selector. Same sunken-track look as the shared
// SegmentControl, but the active segment is colour-coded (green / amber / red)
// so the week's outcome reads at a glance.
function StatusControl({
  value,
  onChange,
}: {
  value: DayStatus;
  onChange: (value: DayStatus) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 rounded-card bg-surface-sunken p-1">
      {STATUS_ORDER.map((status) => {
        const on = status === value;
        return (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(status)}
            className={cn(
              "flex-1 rounded-lg px-0 py-[9px] text-center text-sm transition-all outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-accent-border/40",
              on
                ? cn("font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]", STATUS_META[status].on)
                : "font-medium text-ink-secondary",
            )}
          >
            {STATUS_META[status].label}
          </button>
        );
      })}
    </div>
  );
}

function RatingSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <div className="pt-1">
        <Slider
          aria-label={label}
          min={1}
          max={5}
          value={value}
          onChange={onChange}
        />
      </div>
    </Field>
  );
}
