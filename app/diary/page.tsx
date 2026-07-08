"use client";

import { useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";
import type { DiaryEntry } from "@/lib/plan-data";
import { Card, EmptyState, Skeleton } from "@/components/ui";

type DiaryDay = { key: string; label: string; entries: DiaryEntry[] };

/** Local YYYY-MM-DD for the viewer's timezone (not UTC). */
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSet(
  weight: number | null,
  weightUnit: string,
  reps: number | null,
  toFailure: boolean,
): string {
  const load = weight != null ? `${weight}${weightUnit}` : "BW";
  const count = toFailure ? "to failure" : reps != null ? `${reps}` : "?";
  return `${load} × ${count}`;
}

/** Group flat entries into days using the viewer's LOCAL date. */
function groupByLocalDay(entries: DiaryEntry[]): DiaryDay[] {
  const map = new Map<string, DiaryDay>();
  for (const e of entries) {
    const key = localDateKey(e.loggedAt);
    let day = map.get(key);
    if (!day) {
      day = { key, label: localDateLabel(e.loggedAt), entries: [] };
      map.set(key, day);
    }
    day.entries.push(e);
  }
  // Newest day first (entries already came desc by loggedAt).
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

export default function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[] | undefined>(undefined);

  useEffect(() => {
    fetch("/api/logs")
      .then((res) => res.json())
      .then((data: { entries: DiaryEntry[] }) => setEntries(data.entries ?? []))
      .catch(() => setEntries([]));
  }, []);

  const days = entries ? groupByLocalDay(entries) : [];

  return (
    <main className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-bold">Workout diary</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          What you actually did — weights and reps, dated in your local time.
        </p>
      </header>

      {entries === undefined ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      ) : days.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No workouts logged yet"
          description="Open your plan, tap “Log what you did” under any exercise, and it shows up here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {days.map((day) => (
            <Card key={day.key} className="p-4">
              <h2 className="mb-2 text-[15px] font-semibold">{day.label}</h2>
              <ul className="flex flex-col divide-y divide-divider">
                {day.entries.map((ex) => (
                  <li key={`${ex.loggedAt}-${ex.entryId}`} className="py-2 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">
                      {ex.name}
                      <span className="ml-1.5 text-xs font-normal text-ink-tertiary">
                        · W{ex.weekNumber} {ex.dayLabel}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-secondary">
                      {ex.sets
                        .map((s) => formatSet(s.weight, s.weightUnit, s.reps, s.toFailure))
                        .join(",  ")}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
