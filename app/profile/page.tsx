"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  ageGroup: "25-34" | "35-44" | "45-54" | "55+";
  bodyWeight: string;
  weightUnit: "kg" | "lbs";
  sex: "male" | "female" | "other";
  experience: "beginner" | "intermediate" | "advanced" | "returning";
  goal: "weight_loss" | "muscle_gain" | "strength" | "general_fitness";
  daysPerWeek: number;
  sessionLength: "30-40" | "45-60" | "60-90";
  injuriesText: string;
  injuryKnees: boolean;
  injuryLowerBack: boolean;
  injuryShoulders: boolean;
  cardioIncline: boolean;
  cardioRunning: boolean;
  cardioBike: boolean;
  cardioElliptical: boolean;
  cardioMinimal: boolean;
};

const DEFAULT_STATE: FormState = {
  ageGroup: "25-34",
  bodyWeight: "",
  weightUnit: "lbs",
  sex: "male",
  experience: "beginner",
  goal: "general_fitness",
  daysPerWeek: 3,
  sessionLength: "45-60",
  injuriesText: "",
  injuryKnees: false,
  injuryLowerBack: false,
  injuryShoulders: false,
  cardioIncline: false,
  cardioRunning: false,
  cardioBike: false,
  cardioElliptical: false,
  cardioMinimal: false,
};

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setForm({
            ageGroup: data.profile.ageGroup,
            bodyWeight: String(data.profile.bodyWeight),
            weightUnit: data.profile.weightUnit,
            sex: data.profile.sex,
            experience: data.profile.experience,
            goal: data.profile.goal,
            daysPerWeek: data.profile.daysPerWeek,
            sessionLength: data.profile.sessionLength,
            injuriesText: data.profile.injuriesText ?? "",
            injuryKnees: !!data.profile.injuryKnees,
            injuryLowerBack: !!data.profile.injuryLowerBack,
            injuryShoulders: !!data.profile.injuryShoulders,
            cardioIncline: !!data.profile.cardioIncline,
            cardioRunning: !!data.profile.cardioRunning,
            cardioBike: !!data.profile.cardioBike,
            cardioElliptical: !!data.profile.cardioElliptical,
            cardioMinimal: !!data.profile.cardioMinimal,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const weight = parseFloat(form.bodyWeight);
    if (!weight || weight <= 0) {
      setError("Enter a valid body weight.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, bodyWeight: weight }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      router.push("/plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="p-4">Loading...</main>;
  }

  return (
    <main className="p-4 flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">Your profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Used to tailor your weekly plan — nothing here is shared or stored remotely.
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Age group">
          <select
            value={form.ageGroup}
            onChange={(e) => patch("ageGroup", e.target.value as FormState["ageGroup"])}
            className="select"
          >
            <option value="25-34">25-34</option>
            <option value="35-44">35-44</option>
            <option value="45-54">45-54</option>
            <option value="55+">55+</option>
          </select>
        </Field>

        <Field label="Body weight">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.bodyWeight}
              onChange={(e) => patch("bodyWeight", e.target.value)}
              placeholder="e.g. 165"
              className="select flex-1"
            />
            <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
              {(["lbs", "kg"] as const).map((unit) => (
                <button
                  type="button"
                  key={unit}
                  onClick={() => patch("weightUnit", unit)}
                  className={`px-3 ${
                    form.weightUnit === unit ? "bg-gray-900 text-white" : "bg-white text-gray-600"
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Sex">
          <select
            value={form.sex}
            onChange={(e) => patch("sex", e.target.value as FormState["sex"])}
            className="select"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </Field>

        <Field label="Experience">
          <select
            value={form.experience}
            onChange={(e) => patch("experience", e.target.value as FormState["experience"])}
            className="select"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="returning">Returning after a break</option>
          </select>
        </Field>

        <Field label="Goal">
          <select
            value={form.goal}
            onChange={(e) => patch("goal", e.target.value as FormState["goal"])}
            className="select"
          >
            <option value="weight_loss">Weight loss</option>
            <option value="muscle_gain">Muscle gain</option>
            <option value="strength">Strength</option>
            <option value="general_fitness">General fitness</option>
          </select>
        </Field>

        <Field label={`Days per week: ${form.daysPerWeek}`}>
          <input
            type="range"
            min={2}
            max={6}
            value={form.daysPerWeek}
            onChange={(e) => patch("daysPerWeek", Number(e.target.value))}
            className="w-full"
          />
        </Field>

        <Field label="Session length">
          <select
            value={form.sessionLength}
            onChange={(e) =>
              patch("sessionLength", e.target.value as FormState["sessionLength"])
            }
            className="select"
          >
            <option value="30-40">30-40 min</option>
            <option value="45-60">45-60 min</option>
            <option value="60-90">60-90 min</option>
          </select>
        </Field>

        <Field label="Injuries & limitations">
          <textarea
            value={form.injuriesText}
            onChange={(e) => patch("injuriesText", e.target.value)}
            placeholder="Anything we should know? e.g. 'sore right shoulder from an old injury'"
            className="select h-20 resize-none"
          />
          <div className="flex flex-col gap-2 mt-2">
            <Checkbox
              label="Sensitive knees"
              checked={form.injuryKnees}
              onChange={(v) => patch("injuryKnees", v)}
            />
            <Checkbox
              label="Lower back issues"
              checked={form.injuryLowerBack}
              onChange={(v) => patch("injuryLowerBack", v)}
            />
            <Checkbox
              label="Shoulder issues"
              checked={form.injuryShoulders}
              onChange={(v) => patch("injuryShoulders", v)}
            />
          </div>
        </Field>

        <Field label="Cardio preference">
          <div className="flex flex-col gap-2">
            <Checkbox
              label="Incline walking"
              checked={form.cardioIncline}
              onChange={(v) => patch("cardioIncline", v)}
            />
            <Checkbox
              label="Running"
              checked={form.cardioRunning}
              onChange={(v) => patch("cardioRunning", v)}
            />
            <Checkbox
              label="Bike"
              checked={form.cardioBike}
              onChange={(v) => patch("cardioBike", v)}
            />
            <Checkbox
              label="Elliptical"
              checked={form.cardioElliptical}
              onChange={(v) => patch("cardioElliptical", v)}
            />
            <Checkbox
              label="Minimal cardio"
              checked={form.cardioMinimal}
              onChange={(v) => patch("cardioMinimal", v)}
            />
          </div>
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-gray-900 text-white py-3 font-semibold disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
