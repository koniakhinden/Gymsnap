"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer, Trash2 } from "lucide-react";
import ImageLightbox, { exerciseImageUrl } from "@/components/ImageLightbox";
import type { FullWeek } from "@/lib/plan-data";
import { Button, Card, Badge, Skeleton } from "@/components/ui";

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
  const [deleting, setDeleting] = useState(false);

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

  async function handleDeleteWeek() {
    if (!week) return;
    if (
      !window.confirm(
        `Delete week ${week.weekNumber}? This removes its workouts and check-in and can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/weeks/${week.weekNumber}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete the week.");
      await loadWeek(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeleting(false);
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
    return (
      <main className="flex flex-col gap-4 p-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-12 w-full rounded-btn" />
        <Card className="flex flex-col gap-3 p-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </Card>
      </main>
    );
  }

  const nextWeekLabel = week ? `Generate week ${week.weekNumber + 1}` : "Generate week 1";

  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{week ? `Week ${week.weekNumber}` : "Your plan"}</h1>
        {week && (
          <div className="no-print flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => window.print()}
              className="!px-3 !py-1.5 !text-sm"
            >
              <Printer size={16} strokeWidth={2} />
              Print / Save as PDF
            </Button>
            <Button
              variant="secondary"
              loading={deleting}
              onClick={handleDeleteWeek}
              className="!px-3 !py-1.5 !text-sm !text-error hover:!border-error/40"
            >
              {!deleting && <Trash2 size={16} strokeWidth={2} />}
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-field border border-error/20 bg-error-bg p-3 text-sm text-error">
          {error}
        </div>
      )}
      {warning && (
        <div className="rounded-field border border-warning/25 bg-warning-bg p-3 text-sm text-warning-ink">
          {warning}
        </div>
      )}

      {!week && (
        <Card className="p-4 text-sm text-ink-secondary">
          No plan yet. Make sure your{" "}
          <Link href="/setup" className="text-accent underline hover:text-accent-hover">
            gym setup
          </Link>{" "}
          and{" "}
          <Link href="/profile" className="text-accent underline hover:text-accent-hover">
            profile
          </Link>{" "}
          are complete, then generate your first week.
        </Card>
      )}

      <Button
        block
        size="lg"
        className="no-print"
        loading={generating}
        onClick={handleGenerate}
      >
        {generating ? "Generating..." : nextWeekLabel}
      </Button>

      {generating && (
        <div className="no-print flex items-center gap-2 rounded-field border border-accent-badge-border bg-accent-fill p-3 text-sm text-accent-hover">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent border-t-transparent [animation:spin_0.7s_linear_infinite]" />
          {PROGRESS_MESSAGES[progressIndex]}
        </div>
      )}

      {week && (
        <div className="flex flex-col gap-4">
          {week.days.map((day) => (
            <Card key={day.id} className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-[17px] font-semibold">{day.dayLabel}</h2>
                {day.checkinStatus && (
                  <Badge
                    tone={
                      day.checkinStatus === "completed"
                        ? "success"
                        : day.checkinStatus === "partial"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {day.checkinStatus}
                  </Badge>
                )}
              </div>
              <p className="mb-2 text-sm text-ink-secondary">{day.focus}</p>
              <p className="mb-3 text-xs text-ink-tertiary">
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
                      className="flex gap-3 border-t border-divider pt-2 first:border-t-0 first:pt-0"
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
                            className="h-14 w-14 rounded-md border border-border object-cover"
                          />
                        </button>
                      )}
                      <div className="flex-1 text-sm">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium">
                          {name}
                          {equipmentLabel && <Badge tone="beta">{equipmentLabel}</Badge>}
                          {ex.unverified && <Badge tone="warning">Unverified</Badge>}
                        </p>
                        <p className="text-ink-secondary">
                          {ex.sets} sets x {ex.reps} · {ex.weight || "bodyweight"} · rest{" "}
                          {ex.restSec}s
                        </p>
                        {ex.notes && (
                          <p className="mt-0.5 text-xs text-ink-tertiary">{ex.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {day.cardio && (
                <p className="mt-3 text-xs text-ink-tertiary">
                  <span className="font-medium">Cardio:</span> {day.cardio.type} for{" "}
                  {day.cardio.durationMin} min
                  {day.cardio.incline ? `, incline ${day.cardio.incline}` : ""}
                  {day.cardio.targetHr ? `, target HR ${day.cardio.targetHr}` : ""}
                </p>
              )}

              <p className="mt-2 text-xs text-ink-tertiary">
                <span className="font-medium">Cooldown:</span> {day.cooldown}
              </p>
            </Card>
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
