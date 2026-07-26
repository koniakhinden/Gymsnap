"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card, Skeleton, cn } from "@/components/ui";
import { fetchJson } from "@/lib/safe-fetch";

type DayTotals = {
  day: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  entries: number;
};
type Macros = { calories: number; proteinG: number; fatG: number; carbG: number };
type Summary = {
  from: string;
  to: string;
  days: DayTotals[];
  daysLogged: number;
  totals: Macros;
  avg: Macros;
};

// --- Local-date helpers (mirror the day-view page; all in the device timezone) ---
function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseKey(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shiftDays(k: string, delta: number): string {
  const d = parseKey(k);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}
// Monday-start week containing `k`.
function startOfWeek(k: string): string {
  const d = parseKey(k);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return toKey(d);
}
function rangeFor(mode: "week" | "month", ref: string): { from: string; to: string } {
  if (mode === "week") {
    const from = startOfWeek(ref);
    return { from, to: shiftDays(from, 6) };
  }
  const d = parseKey(ref);
  const from = toKey(new Date(d.getFullYear(), d.getMonth(), 1));
  const to = toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { from, to };
}
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < 400 && cur <= to; i++) {
    out.push(cur);
    cur = shiftDays(cur, 1);
  }
  return out;
}
function periodLabel(mode: "week" | "month", from: string, to: string): string {
  const f = parseKey(from);
  if (mode === "month") {
    return f.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const t = parseKey(to);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${f.toLocaleDateString(undefined, opts)} – ${t.toLocaleDateString(undefined, opts)}`;
}

export default function FoodReport({
  mode,
  target,
  onOpenDay,
}: {
  mode: "week" | "month";
  target: number | null;
  onOpenDay: (day: string) => void;
}) {
  // A reference day inside the shown period; navigation shifts it by a period.
  const [ref, setRef] = useState(() => toKey(new Date()));
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = rangeFor(mode, ref);
  const today = toKey(new Date());
  const atCurrent = to >= today;

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchJson<Summary>(`/api/meal-logs/summary?from=${f}&to=${t}`);
      setData(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(from, to);
  }, [from, to, load]);

  function step(dir: -1 | 1) {
    setRef((r) => (mode === "week" ? shiftDays(r, dir * 7) : shiftMonth(r, dir)));
  }

  const totalsByDay = new Map((data?.days ?? []).map((d) => [d.day, d]));
  const days = eachDay(from, to);
  const maxCal = Math.max(
    target ?? 0,
    ...days.map((d) => totalsByDay.get(d)?.calories ?? 0),
    1
  );
  // A bit of headroom above the tallest bar / target so nothing clips the top.
  const scale = Math.max(maxCal * 1.12, 1);
  const targetPct = target ? Math.min(100, (target / scale) * 100) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Period navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => step(-1)}
          aria-label="Previous period"
          className="!min-h-[40px] !px-2.5"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </Button>
        <span className="text-sm font-semibold">{periodLabel(mode, from, to)}</span>
        <Button
          variant="secondary"
          onClick={() => step(1)}
          disabled={atCurrent}
          aria-label="Next period"
          className="!min-h-[40px] !px-2.5"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </Button>
      </div>

      {error && (
        <div className="rounded-field border border-error/20 bg-error-bg p-3 text-sm text-error">
          {error}
        </div>
      )}

      {loading || !data ? (
        <>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </>
      ) : data.daysLogged === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-secondary">
          Nothing logged this {mode}. Snap or add a meal on any day to see it here.
        </Card>
      ) : (
        <>
          {/* Averages (over days that were actually logged) */}
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-bold tabular-nums">{data.avg.calories}</p>
                <p className="text-xs text-ink-tertiary">avg kcal / logged day</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">
                  {data.daysLogged} {data.daysLogged === 1 ? "day" : "days"} logged
                </p>
                {target && (
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      data.avg.calories > target ? "text-warning-ink" : "text-success",
                    )}
                  >
                    {data.avg.calories > target ? "+" : ""}
                    {data.avg.calories - target} vs {target} target
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-divider pt-3 text-center">
              <MacroStat label="Protein" value={data.avg.proteinG} />
              <MacroStat label="Fat" value={data.avg.fatG} />
              <MacroStat label="Carbs" value={data.avg.carbG} />
            </div>
            <p className="text-[11px] text-ink-tertiary">
              Averages use only days with entries. Totals for the period:{" "}
              {data.totals.calories.toLocaleString()} kcal.
            </p>
          </Card>

          {/* Daily calorie bars vs target. Tap a day to open it. */}
          <Card className="p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-tertiary">
              Calories by day
            </p>
            <div className="overflow-x-auto">
              <div className="min-w-full">
                {/* Plot: relative so the target line's bottom% is measured against
                    the plot height, aligning it with the bars (also % of height). */}
                <div className="relative flex h-40 items-stretch gap-1">
                  {targetPct !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-accent/60"
                      style={{ bottom: `${targetPct}%` }}
                      aria-hidden
                    />
                  )}
                  {days.map((d) => {
                    const cal = totalsByDay.get(d)?.calories ?? 0;
                    const h = (cal / scale) * 100;
                    const over = target ? cal > target : false;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onOpenDay(d)}
                        title={`${d}: ${cal} kcal`}
                        aria-label={`${d}: ${cal} kcal`}
                        className="group flex h-full min-w-[14px] flex-1 flex-col justify-end"
                      >
                        <span
                          className={cn(
                            "w-full rounded-t-sm transition-colors",
                            cal === 0
                              ? "bg-surface-sunken"
                              : over
                                ? "bg-warning group-hover:opacity-80"
                                : "bg-success group-hover:opacity-80",
                          )}
                          style={{ height: `${cal === 0 ? 2 : Math.max(4, h)}%` }}
                        />
                      </button>
                    );
                  })}
                </div>
                {/* Day-number labels, aligned column-for-column with the bars. */}
                <div className="mt-1 flex gap-1">
                  {days.map((d) => (
                    <span
                      key={d}
                      className="min-w-[14px] flex-1 text-center text-[9px] tabular-nums text-ink-tertiary"
                    >
                      {parseKey(d).getDate()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ink-tertiary">
              {target ? (
                <>
                  <span className="text-success">Green</span> = at/under target,{" "}
                  <span className="text-warning-ink">amber</span> = over. Dashed line ={" "}
                  {target} kcal. Tap a day to open it.
                </>
              ) : (
                "Tap a day to open it."
              )}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function MacroStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{value}g</p>
      <p className="text-[11px] text-ink-tertiary">{label}</p>
    </div>
  );
}

// Move `ref` to the same day-of-month one month earlier/later (clamped by the
// Date rollover, which is fine — we only use it to pick a month).
function shiftMonth(k: string, dir: -1 | 1): string {
  const d = parseKey(k);
  return toKey(new Date(d.getFullYear(), d.getMonth() + dir, 1));
}
