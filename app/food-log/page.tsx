"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, X, Camera } from "lucide-react";
import { Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { fetchJson } from "@/lib/safe-fetch";
import { compressPhoto } from "@/lib/compress-photo";
import { computeEaterTargets, type ActivityLevel, type NutritionGoal, type Sex } from "@/lib/nutrition";

type MealLog = {
  id: number;
  name: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
};
type Totals = { calories: number; proteinG: number; fatG: number; carbG: number };

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dayKey(dt);
}
function prettyDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const today = dayKey(new Date());
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function FoodLogPage() {
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [totals, setTotals] = useState<Totals>({ calories: 0, proteinG: 0, fatG: 0, carbG: 0 });
  const [target, setTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cals, setCals] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carb, setCarb] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  // Daily calorie target from the primary eater (or manual override).
  useEffect(() => {
    Promise.all([
      fetchJson<{ eaters: Record<string, unknown>[] }>("/api/eaters"),
      fetchJson<{ settings: Record<string, unknown> | null }>("/api/nutrition-settings"),
    ])
      .then(([e, s]) => {
        const override = s.settings?.calorieTargetOverride as number | undefined;
        if (override) {
          setTarget(override);
          return;
        }
        const primary =
          (e.eaters.find((r) => r.isSelf) as Record<string, unknown> | undefined) ?? e.eaters[0];
        if (primary) {
          const t = computeEaterTargets({
            sex: primary.sex as Sex,
            ageYears: Number(primary.ageYears),
            heightCm: Number(primary.heightCm),
            weightKg: Number(primary.weightKg),
            activity: primary.activity as ActivityLevel,
            goal: primary.goal as NutritionGoal,
          });
          setTarget(t.calories);
        }
      })
      .catch(() => {});
  }, []);

  const loadDay = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const data = await fetchJson<{ logs: MealLog[]; totals: Totals }>(`/api/meal-logs?day=${d}`);
      setLogs(data.logs);
      setTotals(data.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(day);
  }, [day, loadDay]);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson("/api/meal-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day,
          name: name.trim(),
          calories: Number(cals) || 0,
          proteinG: Number(protein) || 0,
          fatG: Number(fat) || 0,
          carbG: Number(carb) || 0,
        }),
      });
      setName("");
      setCals("");
      setProtein("");
      setFat("");
      setCarb("");
      setScanNote(null);
      await loadDay(day);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      await fetchJson(`/api/meal-logs/${id}`, { method: "DELETE" });
      await loadDay(day);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  // Snap the dish or a nutrition label → prefill the form for review.
  async function scanFood(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setScanning(true);
    setError(null);
    setScanNote(null);
    try {
      const compressed = await Promise.all(list.map((f) => compressPhoto(f)));
      const form = new FormData();
      for (const f of compressed) form.append("photos", f);
      const res = await fetch("/api/meal-logs/recognize", { method: "POST", body: form });
      const text = await res.text();
      let data: {
        meal?: { name: string; calories: number; proteinG: number; fatG: number; carbG: number; note: string };
        error?: string;
      } | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (!res.ok) throw new Error(data?.error || `Couldn't read the photo (HTTP ${res.status}).`);
      const m = data?.meal;
      if (m) {
        setName(m.name);
        setCals(String(m.calories));
        setProtein(String(Math.round(m.proteinG)));
        setFat(String(Math.round(m.fatG)));
        setCarb(String(Math.round(m.carbG)));
        setScanNote(m.note ? `${m.note} — check and tap Add.` : "Estimated — check and tap Add.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setScanning(false);
    }
  }

  const pct = target ? Math.min(100, Math.round((totals.calories / target) * 100)) : 0;
  const over = target ? totals.calories > target : false;

  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Food log</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => setDay((d) => addDays(d, -1))}
            aria-label="Previous day"
            className="!min-h-[40px] !px-2.5"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </Button>
          <span className="min-w-[84px] text-center text-sm font-medium">{prettyDay(day)}</span>
          <Button
            variant="secondary"
            onClick={() => setDay((d) => addDays(d, 1))}
            disabled={day >= dayKey(new Date())}
            aria-label="Next day"
            className="!min-h-[40px] !px-2.5"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-field border border-error/20 bg-error-bg p-3 text-sm text-error">{error}</div>
      )}

      {/* Total vs target */}
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">{totals.calories}</span>
          <span className="text-sm text-ink-tertiary">
            {target ? `of ${target} kcal` : "kcal"}
          </span>
        </div>
        {target !== null && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={over ? "h-full bg-error" : "h-full bg-accent"}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <div className="flex gap-4 text-xs text-ink-tertiary">
          <span>{Math.round(totals.proteinG)}g protein</span>
          <span>{Math.round(totals.fatG)}g fat</span>
          <span>{Math.round(totals.carbG)}g carbs</span>
        </div>
        {target === null && (
          <p className="text-[11px] text-ink-tertiary">
            Set your details in{" "}
            <Link href="/profile" className="text-accent underline hover:text-accent-hover">
              Food setup
            </Link>{" "}
            to see a target.
          </p>
        )}
      </Card>

      {/* Quick add */}
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Log a meal</p>
          <input
            ref={scanRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => e.target.files && scanFood(e.target.files)}
          />
          <Button
            variant="secondary"
            loading={scanning}
            onClick={() => scanRef.current?.click()}
            className="!min-h-[36px] !px-3 !text-xs"
          >
            {!scanning && <Camera size={14} strokeWidth={2} />}
            {scanning ? "Reading..." : "Scan photo"}
          </Button>
        </div>
        <p className="-mt-1 text-[11px] text-ink-tertiary">
          Snap the dish, or the packaging / nutrition label of a bar or ready meal.
        </p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What did you eat?"
          className="!py-2"
        />
        {scanNote && <p className="text-[11px] text-accent">{scanNote}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Calories">
            <Input type="number" inputMode="numeric" value={cals} onChange={(e) => setCals(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Protein (g)">
            <Input type="number" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Fat (g)">
            <Input type="number" inputMode="numeric" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Carbs (g)">
            <Input type="number" inputMode="numeric" value={carb} onChange={(e) => setCarb(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <Button onClick={add} loading={saving} disabled={!name.trim()} className="!text-sm">
          <Plus size={16} strokeWidth={2} /> Add
        </Button>
      </Card>

      {/* Entries */}
      {loading ? (
        <Skeleton className="h-24 w-full rounded-card" />
      ) : logs.length === 0 ? (
        <p className="text-center text-sm text-ink-tertiary">Nothing logged yet for {prettyDay(day).toLowerCase()}.</p>
      ) : (
        <Card className="flex flex-col divide-y divide-divider p-0">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{l.name}</p>
                <p className="text-xs text-ink-tertiary">
                  {l.calories} kcal
                  {l.proteinG ? ` · ${Math.round(l.proteinG)}g protein` : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${l.name}`}
                onClick={() => remove(l.id)}
                className="shrink-0 p-1 text-ink-tertiary hover:text-error"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
