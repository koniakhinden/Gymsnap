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
  SegmentControl,
  Slider,
  Skeleton,
  SkeletonCardRow,
} from "@/components/ui";

type DayStatus = "completed" | "partial" | "skipped";

const STATUS_OPTIONS = (["completed", "partial", "skipped"] as DayStatus[]).map(
  (s) => ({ value: s, label: <span className="capitalize">{s}</span> }),
);

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
            initial[d.id] = (d.checkinStatus as DayStatus) ?? "completed";
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
          Go generate a plan
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
        {week.days.map((d) => (
          <Card key={d.id} className="p-3">
            <p className="mb-2 text-sm font-medium">
              {d.dayLabel} — {d.focus}
            </p>
            <SegmentControl<DayStatus>
              options={STATUS_OPTIONS}
              value={statuses[d.id] ?? "completed"}
              onChange={(s) => setStatuses((prev) => ({ ...prev, [d.id]: s }))}
            />
          </Card>
        ))}
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
          {generating ? "Generating..." : `Generate next week (week ${week.weekNumber + 1})`}
        </Button>
      )}
    </main>
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
