"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FullWeek } from "@/lib/plan-data";

type DayStatus = "completed" | "partial" | "skipped";

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
    return <main className="p-4">Loading...</main>;
  }

  if (!week) {
    return (
      <main className="p-4 flex flex-col gap-3">
        <h1 className="text-xl font-bold">No week to check in on yet</h1>
        <Link href="/plan" className="rounded-lg bg-gray-900 text-white py-3 text-center font-semibold">
          Go generate a plan
        </Link>
      </main>
    );
  }

  return (
    <main className="p-4 flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">Check in — Week {week.weekNumber}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tell GymSnap how the week went so next week can adjust.
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {week.days.map((d) => (
          <div key={d.id} className="rounded-lg bg-white border border-gray-200 p-3">
            <p className="text-sm font-medium mb-2">
              {d.dayLabel} — {d.focus}
            </p>
            <div className="flex gap-2">
              {(["completed", "partial", "skipped"] as DayStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatuses((prev) => ({ ...prev, [d.id]: s }))}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize ${
                    statuses[d.id] === s
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-gray-700">Comments</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Anything felt off? Any wins?"
          className="select h-20 resize-none"
        />
      </label>

      <Slider label={`Overall wellbeing: ${wellbeing}/5`} value={wellbeing} onChange={setWellbeing} />
      <Slider label={`Knees: ${knees}/5`} value={knees} onChange={setKnees} />
      <Slider label={`Lower back: ${lowerBack}/5`} value={lowerBack} onChange={setLowerBack} />

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="rounded-lg bg-gray-900 text-white py-3 font-semibold disabled:opacity-40"
      >
        {saving ? "Saving..." : saved ? "Update check-in" : "Save check-in"}
      </button>

      {saved && (
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateNext}
          className="rounded-lg bg-cyan-600 text-white py-3 font-semibold disabled:opacity-40"
        >
          {generating ? "Generating..." : `Generate next week (week ${week.weekNumber + 1})`}
        </button>
      )}
    </main>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
