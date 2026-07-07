"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ImageLightbox, { exerciseImageUrl } from "@/components/ImageLightbox";
import type { FullWeek } from "@/lib/plan-data";

const PROGRESS_MESSAGES = [
  "Reviewing your profile and equipment...",
  "Checking your training history...",
  "Balancing volume and recovery...",
  "Writing up your week...",
];

const EQUIPMENT_LABELS: Record<string, string> = {
  "body only": "Bodyweight",
  cable: "Cable station",
  machine: "Machine",
  dumbbell: "Dumbbells",
  barbell: "Barbell",
  kettlebells: "Kettlebell",
  "medicine ball": "Medicine ball",
  "exercise ball": "Exercise ball",
  bands: "Band",
  "e-z curl bar": "EZ bar",
  "foam roll": "Foam roller",
  other: "Other",
};

function formatEquipmentLabel(equipment: string | null | undefined): string | null {
  if (!equipment) return null;
  return EQUIPMENT_LABELS[equipment] ?? equipment;
}

export default function PlanPage() {
  const [week, setWeek] = useState<FullWeek | null | undefined>(undefined);
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; title: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get("week");
    loadWeek(w ? Number(w) : null);
  }, []);

  async function loadWeek(num: number | null) {
    setLoadingWeek(true);
    try {
      const url = num ? `/api/plan?week=${num}` : "/api/plan";
      const res = await fetch(url);
      const data = await res.json();
      setWeek(data.week);
    } finally {
      setLoadingWeek(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setWarning(null);
    setProgressIndex(0);
    const interval = setInterval(() => {
      setProgressIndex((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1));
    }, 3000);
    try {
      const res = await fetch("/api/plan/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan.");
      if (data.hasUnverified) {
        setWarning(
          "Some exercises couldn't be matched to the library and were marked unverified — please review them below."
        );
      }
      await loadWeek(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      clearInterval(interval);
      setGenerating(false);
    }
  }

  if (loadingWeek) {
    return <main className="p-4">Loading...</main>;
  }

  const nextWeekLabel = week ? `Generate week ${week.weekNumber + 1}` : "Generate week 1";

  return (
    <main className="p-4 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{week ? `Week ${week.weekNumber}` : "Your plan"}</h1>
        {week && (
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print text-sm font-medium text-cyan-700 border border-cyan-200 rounded-md px-3 py-1.5"
          >
            Print / Save as PDF
          </button>
        )}
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </div>
      )}
      {warning && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3">
          {warning}
        </div>
      )}

      {!week && (
        <div className="rounded-lg bg-white border border-gray-200 p-4 text-sm text-gray-600">
          No plan yet. Make sure your{" "}
          <Link href="/setup" className="underline">
            gym setup
          </Link>{" "}
          and{" "}
          <Link href="/profile" className="underline">
            profile
          </Link>{" "}
          are complete, then generate your first week.
        </div>
      )}

      <button
        type="button"
        disabled={generating}
        onClick={handleGenerate}
        className="no-print rounded-lg bg-gray-900 text-white py-3 font-semibold disabled:opacity-40"
      >
        {generating ? "Generating..." : nextWeekLabel}
      </button>

      {generating && (
        <div className="no-print rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 text-sm p-3 flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-600 border-t-transparent animate-spin" />
          {PROGRESS_MESSAGES[progressIndex]}
        </div>
      )}

      {week && (
        <div className="flex flex-col gap-4">
          {week.days.map((day) => (
            <section key={day.id} className="rounded-xl bg-white border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold">{day.dayLabel}</h2>
                {day.checkinStatus && (
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                      day.checkinStatus === "completed"
                        ? "bg-green-100 text-green-700"
                        : day.checkinStatus === "partial"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {day.checkinStatus}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-2">{day.focus}</p>
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-medium">Warmup:</span> {day.warmup}
              </p>

              <div className="flex flex-col gap-2">
                {day.exercises.map((ex) => {
                  const name = ex.nameOverride ?? ex.exercise?.name ?? "Exercise";
                  const images = ex.exercise?.images ?? [];
                  const equipmentLabel = formatEquipmentLabel(ex.exercise?.equipment);
                  return (
                    <div
                      key={ex.id}
                      className="flex gap-3 border-t border-gray-100 pt-2 first:border-t-0 first:pt-0"
                    >
                      {images.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setLightbox({ images, title: name })}
                          className="no-print shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={exerciseImageUrl(images[0])}
                            alt={name}
                            className="h-14 w-14 object-cover rounded-md border border-gray-200"
                          />
                        </button>
                      )}
                      <div className="flex-1 text-sm">
                        <p className="font-medium flex items-center gap-1.5 flex-wrap">
                          {name}
                          {equipmentLabel && (
                            <span className="text-xs rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 px-1.5 py-0.5">
                              {equipmentLabel}
                            </span>
                          )}
                          {ex.unverified && (
                            <span className="text-xs rounded-full bg-yellow-100 text-yellow-700 px-1.5 py-0.5">
                              Unverified
                            </span>
                          )}
                        </p>
                        <p className="text-gray-500">
                          {ex.sets} sets x {ex.reps} · {ex.weight || "bodyweight"} · rest{" "}
                          {ex.restSec}s
                        </p>
                        {ex.notes && <p className="text-gray-400 text-xs mt-0.5">{ex.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {day.cardio && (
                <p className="text-xs text-gray-500 mt-3">
                  <span className="font-medium">Cardio:</span> {day.cardio.type} for{" "}
                  {day.cardio.durationMin} min
                  {day.cardio.incline ? `, incline ${day.cardio.incline}` : ""}
                  {day.cardio.targetHr ? `, target HR ${day.cardio.targetHr}` : ""}
                </p>
              )}

              <p className="text-xs text-gray-500 mt-2">
                <span className="font-medium">Cooldown:</span> {day.cooldown}
              </p>
            </section>
          ))}
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </main>
  );
}
