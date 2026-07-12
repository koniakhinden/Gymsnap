"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer, FileText, Trash2 } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import DayCard from "@/components/DayCard";
import RoutineItemRow from "@/components/RoutineItemRow";
import type { FullWeek } from "@/lib/plan-data";
import { Button, Card, Skeleton } from "@/components/ui";

type ExportMode = "illustrated" | "compact";

const PROGRESS_MESSAGES = [
  "Reviewing your profile and equipment...",
  "Checking your past weeks...",
  "Balancing volume and recovery...",
  "Writing up your week...",
];

export default function PlanPage() {
  const [week, setWeek] = useState<FullWeek | null | undefined>(undefined);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("illustrated");
  const [preparingMode, setPreparingMode] = useState<ExportMode | null>(null);
  // Accordion: at most one day is in "fill workout" (log) mode at a time.
  const [openDayId, setOpenDayId] = useState<number | null>(null);

  // One-tap export: pick a style and print immediately. We flip exportMode (which
  // drives the `export-<mode>` class on <main>), wait for React to paint that
  // class, and — for the illustrated style — wait for every preview to decode so
  // the browser doesn't print before the remote images load and leave them blank.
  async function handleExport(mode: ExportMode) {
    setExportMode(mode);
    setPreparingMode(mode);
    try {
      // Let the export-<mode> class apply before we measure/print.
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      );
      if (mode === "illustrated") {
        const imgs = Array.from(
          document.querySelectorAll<HTMLImageElement>(".exercise-thumb img")
        );
        await Promise.all(
          imgs.map((img) =>
            img.decode().catch(() => {
              /* skip images that fail to load; don't block printing */
            })
          )
        );
      }
    } finally {
      setPreparingMode(null);
    }
    window.print();
  }

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
      if (data.weightUnit) setWeightUnit(data.weightUnit);
    } finally {
      setLoadingWeek(false);
    }
  }

  async function handleDeleteWeek() {
    if (!week) return;

    // Count real workout data so the warning is honest about what's lost.
    const loggedSets = week.days.reduce(
      (sum, d) => sum + d.exercises.reduce((s, e) => s + e.logs.length, 0),
      0
    );

    const baseMsg = `Delete week ${week.weekNumber}? This removes its exercise suggestions and check-in and can't be undone.`;
    if (!window.confirm(baseMsg)) return;

    // Second, stronger gate when the week holds logged workouts — these are the
    // sets you actually recorded at the gym, so never delete them on one tap.
    if (loggedSets > 0) {
      const confirmText = "delete";
      const typed = window.prompt(
        `This week has ${loggedSets} logged set${loggedSets === 1 ? "" : "s"} from workouts you actually did. Deleting is permanent.\n\nType "${confirmText}" to confirm.`
      );
      if (typed?.trim().toLowerCase() !== confirmText) return;
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
      if (!res.ok) throw new Error(data.error || "Failed to build suggestions.");
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

  const nextWeekLabel = week
    ? `Suggest exercises for week ${week.weekNumber + 1}`
    : "Suggest exercises for week 1";

  return (
    <main className={`flex flex-col gap-4 p-4 export-${exportMode}`}>
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{week ? `Week ${week.weekNumber}` : "Your weekly suggestions"}</h1>
        {week && (
          <div className="no-print flex items-center gap-2">
            <Button
              variant="secondary"
              loading={deleting}
              onClick={handleDeleteWeek}
              className="!min-h-[44px] !px-3.5 !text-sm !text-error hover:!border-error/40"
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
          No suggestions yet. Make sure your{" "}
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
            <DayCard
              key={day.id}
              day={day}
              weightUnit={weightUnit}
              isOpen={openDayId === day.id}
              onOpen={() => setOpenDayId(day.id)}
              onDone={() => setOpenDayId((cur) => (cur === day.id ? null : cur))}
              onImageClick={(images, title) => setLightbox({ images, title })}
            />
          ))}
        </div>
      )}

      {week && week.stretchBlocks.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-[17px] font-semibold">Stretching</h2>
            <p className="text-xs text-ink-tertiary">
              Optional recovery work — doesn’t affect your week’s completion.
            </p>
          </div>
          {week.stretchBlocks.map((block, bi) => (
            <div key={bi} className="border-t border-divider pt-3 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium">
                {block.title}
                {block.targetMuscles.length > 0 && (
                  <span className="ml-1 font-normal text-ink-tertiary">
                    · {block.targetMuscles.join(", ")}
                  </span>
                )}
              </p>
              <ul className="mt-1.5 flex flex-col gap-2">
                {block.items.map((it, ii) => (
                  <RoutineItemRow
                    key={ii}
                    item={it}
                    onImageClick={(images, title) => setLightbox({ images, title })}
                  />
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      {week && (
        <div className="no-print flex flex-col gap-1.5">
          <span className="text-xs text-ink-tertiary">Save this week as PDF</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              block
              loading={preparingMode === "illustrated"}
              onClick={() => handleExport("illustrated")}
              className="!text-sm"
            >
              {preparingMode !== "illustrated" && <Printer size={16} strokeWidth={2} />}
              With images
            </Button>
            <Button
              variant="secondary"
              block
              loading={preparingMode === "compact"}
              onClick={() => handleExport("compact")}
              className="!text-sm"
            >
              {preparingMode !== "compact" && <FileText size={16} strokeWidth={2} />}
              Text only
            </Button>
          </div>
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
