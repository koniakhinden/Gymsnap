"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Field, Input, Select, Skeleton } from "@/components/ui";
import { fetchJson } from "@/lib/safe-fetch";
import {
  computeHouseholdTargets,
  type ActivityLevel,
  type EaterInput,
  type NutritionGoal,
  type Sex,
} from "@/lib/nutrition";

type EaterForm = {
  id?: number;
  name: string;
  isSelf: boolean;
  sex: Sex;
  ageYears: string;
  heightCm: string;
  weightKg: string;
  activity: ActivityLevel;
  goal: NutritionGoal;
  dietary: string; // comma-separated in the form
  allergies: string;
};

type SettingsForm = {
  country: string;
  region: string;
  city: string;
  cuisines: string;
  likes: string;
  dislikes: string;
  budgetLevel: "" | "low" | "medium" | "high";
  calorieTargetOverride: string;
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little/no exercise)",
  light: "Light (1-3 days/wk)",
  moderate: "Moderate (3-5 days/wk)",
  active: "Active (6-7 days/wk)",
  very_active: "Very active (hard daily)",
};
const GOAL_LABELS: Record<NutritionGoal, string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight",
};

function newEater(isSelf = false): EaterForm {
  return {
    name: isSelf ? "You" : "",
    isSelf,
    sex: "male",
    ageYears: "30",
    heightCm: "175",
    weightKg: "75",
    activity: "moderate",
    goal: "maintain",
    dietary: "",
    allergies: "",
  };
}

function toList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function toEaterInput(e: EaterForm): EaterInput | null {
  const ageYears = Number(e.ageYears);
  const heightCm = Number(e.heightCm);
  const weightKg = Number(e.weightKg);
  if (!ageYears || !heightCm || !weightKg) return null;
  return { sex: e.sex, ageYears, heightCm, weightKg, activity: e.activity, goal: e.goal };
}

export default function NutritionSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eaters, setEaters] = useState<EaterForm[]>([newEater(true)]);
  const [settings, setSettings] = useState<SettingsForm>({
    country: "",
    region: "",
    city: "",
    cuisines: "",
    likes: "",
    dislikes: "",
    budgetLevel: "",
    calorieTargetOverride: "",
  });

  useEffect(() => {
    Promise.all([
      fetchJson<{ eaters: Record<string, unknown>[] }>("/api/eaters"),
      fetchJson<{ settings: Record<string, unknown> | null }>("/api/nutrition-settings"),
    ])
      .then(([e, s]) => {
        if (e.eaters.length > 0) {
          setEaters(
            e.eaters.map((r) => ({
              id: r.id as number,
              name: (r.name as string) ?? "",
              isSelf: !!r.isSelf,
              sex: r.sex as Sex,
              ageYears: String(r.ageYears ?? ""),
              heightCm: String(r.heightCm ?? ""),
              weightKg: String(r.weightKg ?? ""),
              activity: r.activity as ActivityLevel,
              goal: r.goal as NutritionGoal,
              dietary: ((r.dietary as string[]) ?? []).join(", "),
              allergies: ((r.allergies as string[]) ?? []).join(", "),
            }))
          );
        }
        if (s.settings) {
          const g = s.settings;
          setSettings({
            country: (g.country as string) ?? "",
            region: (g.region as string) ?? "",
            city: (g.city as string) ?? "",
            cuisines: ((g.cuisines as string[]) ?? []).join(", "),
            likes: ((g.likes as string[]) ?? []).join(", "),
            dislikes: ((g.dislikes as string[]) ?? []).join(", "),
            budgetLevel: (g.budgetLevel as SettingsForm["budgetLevel"]) ?? "",
            calorieTargetOverride: g.calorieTargetOverride ? String(g.calorieTargetOverride) : "",
          });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  function patchEater(i: number, patch: Partial<EaterForm>) {
    setEaters((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
    setSaved(false);
  }
  function addEater() {
    setEaters((prev) => [...prev, newEater(false)]);
    setSaved(false);
  }
  function removeEater(i: number) {
    setEaters((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }
  function patchSettings(patch: Partial<SettingsForm>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    // Validate numeric fields make an eater computable.
    for (const e of eaters) {
      if (!toEaterInput(e)) {
        setError("Fill age, height and weight for every person.");
        return;
      }
    }
    setSaving(true);
    try {
      await fetchJson("/api/eaters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eaters: eaters.map((e) => ({
            id: e.id,
            name: e.name,
            isSelf: e.isSelf,
            sex: e.sex,
            ageYears: Number(e.ageYears),
            heightCm: Number(e.heightCm),
            weightKg: Number(e.weightKg),
            activity: e.activity,
            goal: e.goal,
            dietary: toList(e.dietary),
            allergies: toList(e.allergies),
          })),
        }),
      });
      await fetchJson("/api/nutrition-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: settings.country,
          region: settings.region,
          city: settings.city,
          cuisines: toList(settings.cuisines),
          likes: toList(settings.likes),
          dislikes: toList(settings.dislikes),
          budgetLevel: settings.budgetLevel || null,
          calorieTargetOverride: settings.calorieTargetOverride
            ? Number(settings.calorieTargetOverride)
            : null,
        }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const inputs = eaters.map(toEaterInput).filter((x): x is EaterInput => x !== null);
  const targets = inputs.length > 0 ? computeHouseholdTargets(inputs) : null;

  if (loading) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-bold">Food setup</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Tell GymSnap who you cook for and what you like, so meals fit your calories,
          tastes and what&apos;s in local stores.
        </p>
      </header>

      {error && (
        <div className="rounded-field border border-error/20 bg-error-bg p-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Household */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Who&apos;s eating?</h2>
        {eaters.map((e, i) => (
          <Card key={i} className="flex flex-col gap-2.5 p-4">
            <div className="flex items-center justify-between gap-2">
              <Input
                value={e.name}
                onChange={(ev) => patchEater(i, { name: ev.target.value })}
                placeholder={e.isSelf ? "You" : "Family member"}
                className="!py-2 font-medium"
              />
              {!e.isSelf && (
                <Button
                  variant="secondary"
                  onClick={() => removeEater(i)}
                  aria-label="Remove"
                  className="!min-h-[40px] !px-3 !text-sm !text-error hover:!border-error/40"
                >
                  <Trash2 size={16} strokeWidth={2} />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Sex">
                <Select value={e.sex} onChange={(ev) => patchEater(i, { sex: ev.target.value as Sex })}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Age">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={e.ageYears}
                  onChange={(ev) => patchEater(i, { ageYears: ev.target.value })}
                />
              </Field>
              <Field label="Height (cm)">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={e.heightCm}
                  onChange={(ev) => patchEater(i, { heightCm: ev.target.value })}
                />
              </Field>
              <Field label="Weight (kg)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={e.weightKg}
                  onChange={(ev) => patchEater(i, { weightKg: ev.target.value })}
                />
              </Field>
              <Field label="Activity">
                <Select
                  value={e.activity}
                  onChange={(ev) => patchEater(i, { activity: ev.target.value as ActivityLevel })}
                >
                  {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
                    <option key={a} value={a}>
                      {ACTIVITY_LABELS[a]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Goal">
                <Select
                  value={e.goal}
                  onChange={(ev) => patchEater(i, { goal: ev.target.value as NutritionGoal })}
                >
                  {(Object.keys(GOAL_LABELS) as NutritionGoal[]).map((g) => (
                    <option key={g} value={g}>
                      {GOAL_LABELS[g]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Dietary (comma-separated, e.g. halal, vegetarian)">
              <Input
                value={e.dietary}
                onChange={(ev) => patchEater(i, { dietary: ev.target.value })}
                placeholder="none"
              />
            </Field>
            <Field label="Allergies (comma-separated)">
              <Input
                value={e.allergies}
                onChange={(ev) => patchEater(i, { allergies: ev.target.value })}
                placeholder="none"
              />
            </Field>
          </Card>
        ))}
        <Button variant="secondary" onClick={addEater} className="!text-sm">
          <Plus size={16} strokeWidth={2} /> Add family member
        </Button>
      </section>

      {/* Location & preferences */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Location &amp; tastes</h2>
        <Card className="flex flex-col gap-2.5 p-4">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Country">
              <Input value={settings.country} onChange={(e) => patchSettings({ country: e.target.value })} placeholder="Canada" />
            </Field>
            <Field label="Region">
              <Input value={settings.region} onChange={(e) => patchSettings({ region: e.target.value })} placeholder="Alberta" />
            </Field>
            <Field label="City">
              <Input value={settings.city} onChange={(e) => patchSettings({ city: e.target.value })} placeholder="Calgary" />
            </Field>
          </div>
          <Field label="Cuisines you like (comma-separated)">
            <Input value={settings.cuisines} onChange={(e) => patchSettings({ cuisines: e.target.value })} placeholder="Ukrainian, Mediterranean" />
          </Field>
          <Field label="Favorite foods (even if not local — e.g. buckwheat)">
            <Input value={settings.likes} onChange={(e) => patchSettings({ likes: e.target.value })} placeholder="buckwheat, cottage cheese" />
          </Field>
          <Field label="Dislikes / avoid">
            <Input value={settings.dislikes} onChange={(e) => patchSettings({ dislikes: e.target.value })} placeholder="cilantro, liver" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Budget">
              <Select
                value={settings.budgetLevel}
                onChange={(e) => patchSettings({ budgetLevel: e.target.value as SettingsForm["budgetLevel"] })}
              >
                <option value="">No preference</option>
                <option value="low">Budget</option>
                <option value="medium">Moderate</option>
                <option value="high">Flexible</option>
              </Select>
            </Field>
            <Field label="Manual kcal/day (optional)">
              <Input
                type="number"
                inputMode="numeric"
                value={settings.calorieTargetOverride}
                onChange={(e) => patchSettings({ calorieTargetOverride: e.target.value })}
                placeholder="auto"
              />
            </Field>
          </div>
        </Card>
      </section>

      {/* Computed targets */}
      {targets && (
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-sm font-semibold">Daily targets (estimated)</p>
          <div className="flex flex-col gap-1 text-[13px] text-ink-secondary">
            {targets.perEater.map((t, i) => (
              <div key={i} className="flex justify-between">
                <span>{eaters[i]?.name || `Person ${i + 1}`}</span>
                <span className="tabular-nums">
                  {settings.calorieTargetOverride ? Number(settings.calorieTargetOverride) : t.calories} kcal ·{" "}
                  {t.proteinG}p / {t.fatG}f / {t.carbG}c
                </span>
              </div>
            ))}
            {eaters.length > 1 && (
              <div className="mt-1 flex justify-between border-t border-divider pt-1 font-medium text-ink">
                <span>Household / day</span>
                <span className="tabular-nums">{targets.calories} kcal</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-ink-tertiary">
            Estimates from height, weight, age, sex and activity (Mifflin-St Jeor). Weight-loss
            targets are capped at a safe deficit.
          </p>
        </Card>
      )}

      <Button
        block
        size="lg"
        loading={saving}
        onClick={handleSave}
        variant={saved ? "secondary" : "primary"}
      >
        {saving ? "Saving..." : saved ? "Saved" : "Save"}
      </Button>

      <Card className="p-3 text-xs text-ink-tertiary">
        Meal ideas are informational only — not medical, dietary or professional nutrition
        advice. GymSnap doesn&apos;t assess your health conditions. Check with a doctor or
        dietitian before making significant diet changes, and always respect your own allergies.
        <div className="mt-1">
          <Link href="/legal" className="text-accent underline hover:text-accent-hover">
            Terms &amp; disclaimers
          </Link>
        </div>
      </Card>
    </main>
  );
}
