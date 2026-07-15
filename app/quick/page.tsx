"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, BookOpen, ChevronDown } from "lucide-react";
import ImageLightbox, { exerciseImageUrl } from "@/components/ImageLightbox";
import { compressPhoto } from "@/lib/compress-photo";
import { fetchJson } from "@/lib/safe-fetch";
import {
  Button,
  Card,
  OptionCard,
  Pill,
  PillGroup,
  SegmentControl,
  Textarea,
  Input,
  Badge,
  cn,
} from "@/components/ui";

const MAX_FILES = 10;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".heic", ".heif"];

type EquipmentMode = "saved" | "photo" | "none";
type Category = "cardio" | "strength_machine" | "free_weights" | "accessories";
type EquipmentItem = { name: string; category: Category };

const FOCUS_CHIPS = [
  "Legs",
  "Glutes",
  "Calves & ankles",
  "Back",
  "Chest",
  "Shoulders",
  "Arms",
  "Core",
  "Full body",
  "Mobility / stretching",
];

// Cardio sessions pick a style rather than a muscle group.
const CARDIO_CHIPS = [
  "Steady state (zone 2)",
  "Intervals / HIIT",
  "Low impact",
  "Fat burn",
  "Endurance",
];

const SESSION_TYPES: { value: "strength" | "cardio" | "mixed"; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardio" },
  { value: "mixed", label: "Mixed" },
];

function chipsForSessionType(t: "strength" | "cardio" | "mixed"): string[] {
  return t === "cardio" ? CARDIO_CHIPS : FOCUS_CHIPS;
}

const TIME_OPTIONS: { value: 10 | 20 | 30 | 45; label: string }[] = [
  { value: 10, label: "10 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45+ min" },
];

const BUILD_MESSAGES = [
  "Reading what you've got...",
  "Matching moves to your goal...",
  "Checking for anything to avoid...",
  "Writing up your session...",
];

type Block = {
  exerciseId: string | null;
  nameOverride: string | null;
  sets: number;
  reps: string;
  weightOrBand: string | null;
  restSec: number;
  whyIncluded: string;
  easierOption: string;
  harderOption: string;
  exercise: {
    id: string;
    name: string;
    images: string[];
    equipment: string | null;
    instructions: string[];
  } | null;
};
type Segment = { name: string; howTo: string; durationOrReps: string };
type SessionType = "strength" | "cardio" | "mixed";
type Workout = {
  title: string;
  focus: string;
  sessionType?: SessionType;
  totalMin: number;
  warmup: Segment[];
  blocks: Block[];
  cardio?: Segment[];
  cooldown: Segment[];
  cautions: string[];
};

type HistoryItem = {
  id: number;
  createdAt: string;
  equipmentMode: EquipmentMode;
  equipment: EquipmentItem[];
  sessionType?: SessionType;
  focusChips: string[];
  focusText: string;
  timeMin: number;
  title: string;
  focus: string;
};

type PickedPhoto = { file: File; previewUrl: string };

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXT.some((ext) => name.endsWith(ext));
}

function prettyEquipment(raw: string | null): string {
  if (!raw) return "bodyweight";
  const map: Record<string, string> = {
    "body only": "bodyweight",
    bands: "resistance band",
    dumbbell: "dumbbell",
    barbell: "barbell",
    kettlebells: "kettlebell",
    cable: "cable",
    machine: "machine",
    "medicine ball": "medicine ball",
    "exercise ball": "exercise ball",
    "e-z curl bar": "EZ-bar",
    "foam roll": "foam roller",
    other: "other",
  };
  return map[raw] ?? raw;
}

function blockBadge(block: Block): string {
  if (block.weightOrBand && block.weightOrBand.trim()) return block.weightOrBand;
  if (block.exercise) return prettyEquipment(block.exercise.equipment);
  return "bodyweight";
}

export default function QuickWorkoutPage() {
  // ---- equipment step ----
  const [mode, setMode] = useState<EquipmentMode>("none");
  const [hasSavedGym, setHasSavedGym] = useState<boolean | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  // photo sub-flow
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [recognizing, setRecognizing] = useState(false);
  const [recognized, setRecognized] = useState<EquipmentItem[] | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- focus step ----
  const [sessionType, setSessionType] = useState<SessionType>("strength");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [focusText, setFocusText] = useState("");

  // ---- time step ----
  const [timeMin, setTimeMin] = useState<10 | 20 | 30 | 45>(20);

  // ---- generation / result ----
  const [building, setBuilding] = useState(false);
  const [buildIndex, setBuildIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [expanded, setExpanded] = useState<Record<number, "easier" | "harder" | "how" | null>>({});
  const [lightbox, setLightbox] = useState<{ images: string[]; title: string } | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Default to the saved gym when one exists.
  useEffect(() => {
    fetch("/api/gym")
      .then((r) => r.json())
      .then((data) => {
        const count = data?.items?.length ?? 0;
        setHasSavedGym(count > 0);
        setSavedCount(count);
        if (count > 0) setMode("saved");
      })
      .catch(() => setHasSavedGym(false));
    loadHistory();
  }, []);

  useEffect(() => {
    if (!building) return;
    const id = setInterval(() => {
      setBuildIndex((i) => Math.min(i + 1, BUILD_MESSAGES.length - 1));
    }, 3000);
    return () => clearInterval(id);
  }, [building]);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    try {
      const data = await fetchJson<{ history?: HistoryItem[] }>("/api/quick-workout");
      setHistory(data.history ?? []);
    } catch {
      // history is non-critical
    }
  }

  function addFiles(fileList: FileList | File[]) {
    setError(null);
    const accepted: PickedPhoto[] = [];
    for (const file of Array.from(fileList)) {
      if (!isAcceptedFile(file)) {
        setError(`Unsupported file: ${file.name}. Use JPEG, PNG, or HEIC.`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setPhotos((prev) => {
      const combined = [...prev, ...accepted];
      if (combined.length > MAX_FILES) {
        setError(`You can upload up to ${MAX_FILES} photos.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  }

  async function handleRecognize() {
    if (photos.length === 0) return;
    setRecognizing(true);
    setError(null);
    try {
      const compressed = await Promise.all(photos.map((p) => compressPhoto(p.file)));
      const formData = new FormData();
      for (const file of compressed) formData.append("photos", file);

      const res = await fetch("/api/quick-workout/recognize", {
        method: "POST",
        body: formData,
      });
      const text = await res.text();
      let data: { items?: EquipmentItem[]; error?: string } | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (!res.ok) {
        throw new Error(data?.error || `Recognition failed (HTTP ${res.status}).`);
      }
      setRecognized(data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRecognizing(false);
    }
  }

  function removeRecognized(index: number) {
    setRecognized((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function addRecognizedItem() {
    const name = newItemName.trim();
    if (!name) return;
    setRecognized((prev) => [...(prev ?? []), { name, category: "accessories" }]);
    setNewItemName("");
  }

  function toggleChip(chip: string) {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  }

  // Strength and cardio offer different chips, so drop any that no longer apply
  // when the user switches session type.
  function changeSessionType(next: SessionType) {
    setSessionType(next);
    const allowed = new Set(chipsForSessionType(next));
    setSelectedChips((prev) => prev.filter((c) => allowed.has(c)));
  }

  async function handleBuild() {
    setError(null);
    // photo mode requires a confirmed list
    const equipmentItems =
      mode === "photo" ? recognized ?? [] : [];
    setBuilding(true);
    setBuildIndex(0);
    setWorkout(null);
    try {
      const data = await fetchJson<{ workout: Workout }>("/api/quick-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentMode: mode,
          equipmentItems,
          sessionType,
          focusChips: selectedChips,
          focusText,
          timeMin,
        }),
      });
      setWorkout(data.workout);
      setExpanded({});
      window.scrollTo({ top: 0, behavior: "smooth" });
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBuilding(false);
    }
  }

  async function openHistory(item: HistoryItem) {
    setError(null);
    try {
      const data = await fetchJson<{ workout: Workout }>(`/api/quick-workout/${item.id}`);
      setWorkout(data.workout);
      setExpanded({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function repeat(item: HistoryItem) {
    setWorkout(null);
    setError(null);
    setMode(item.equipmentMode);
    if (item.equipmentMode === "photo") {
      setRecognized(item.equipment);
      setPhotos([]);
    }
    setSessionType(item.sessionType ?? "strength");
    setSelectedChips(item.focusChips);
    setFocusText(item.focusText);
    setTimeMin(item.timeMin as 10 | 20 | 30 | 45);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForNew() {
    setWorkout(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Photo mode can't build until a list is confirmed.
  const buildDisabled = building || (mode === "photo" && recognized === null);

  // ---------------- RESULT VIEW ----------------
  if (workout) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <header>
          <h1 className="text-xl font-bold">{workout.title}</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {workout.focus} · ~{workout.totalMin} min
          </p>
        </header>

        {workout.cautions.length > 0 && (
          <div className="rounded-field border border-warning/25 bg-warning-bg p-3 text-sm text-warning-ink">
            <p className="mb-1 font-semibold">Before you start</p>
            <ul className="list-disc space-y-1 pl-4">
              {workout.cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {workout.warmup.length > 0 && (
          <SegmentCard title="Warmup" segments={workout.warmup} />
        )}

        <section className="flex flex-col gap-3">
          {workout.blocks.map((block, i) => {
            const name = block.exercise?.name ?? block.nameOverride ?? "Exercise";
            const images = block.exercise?.images ?? [];
            const open = expanded[i] ?? null;
            return (
              <Card key={i} className="p-4">
                <div className="flex gap-3">
                  {images.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLightbox({ images, title: name })}
                      className="shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={exerciseImageUrl(images[0])}
                        alt={name}
                        className="h-16 w-16 rounded-md border border-border object-cover"
                      />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {i + 1}. {name}
                      </p>
                      <span className="shrink-0">
                        <Badge tone="neutral">{blockBadge(block)}</Badge>
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-secondary">
                      {block.sets} sets × {block.reps} · rest {block.restSec}s
                    </p>
                    {block.whyIncluded && (
                      <p className="mt-1 text-xs text-ink-tertiary">{block.whyIncluded}</p>
                    )}
                    {(block.exercise?.instructions?.length ?? 0) > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((p) => ({ ...p, [i]: open === "how" ? null : "how" }))
                          }
                          aria-expanded={open === "how"}
                          className="mt-1 inline-flex min-h-[36px] items-center gap-1 text-[13px] font-semibold text-accent transition-colors hover:text-accent-hover"
                        >
                          <BookOpen size={14} strokeWidth={2} />
                          How to do it
                          <ChevronDown
                            size={14}
                            strokeWidth={2.5}
                            className={cn("transition-transform", open === "how" && "rotate-180")}
                          />
                        </button>
                        {open === "how" && (
                          <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-4 text-xs text-ink-secondary">
                            {block.exercise!.instructions.map((step, si) => (
                              <li key={si}>{step}</li>
                            ))}
                          </ol>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {block.easierOption && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((p) => ({ ...p, [i]: open === "easier" ? null : "easier" }))
                      }
                      className={cn(
                        "flex-1 rounded-btn border py-1.5 text-xs font-medium transition-colors",
                        open === "easier"
                          ? "border-accent-border bg-accent-fill text-accent-hover"
                          : "border-border-strong text-ink-secondary hover:border-ink-disabled",
                      )}
                    >
                      Easier
                    </button>
                  )}
                  {block.harderOption && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((p) => ({ ...p, [i]: open === "harder" ? null : "harder" }))
                      }
                      className={cn(
                        "flex-1 rounded-btn border py-1.5 text-xs font-medium transition-colors",
                        open === "harder"
                          ? "border-accent-border bg-accent-fill text-accent-hover"
                          : "border-border-strong text-ink-secondary hover:border-ink-disabled",
                      )}
                    >
                      Harder
                    </button>
                  )}
                </div>
                {open && (
                  <p className="mt-2 rounded-lg bg-bg p-2 text-xs text-ink-secondary">
                    {open === "easier" ? block.easierOption : block.harderOption}
                  </p>
                )}
              </Card>
            );
          })}
        </section>

        {workout.cardio && workout.cardio.length > 0 && (
          <SegmentCard title="Cardio" segments={workout.cardio} />
        )}

        {workout.cooldown.length > 0 && (
          <SegmentCard title="Cooldown" segments={workout.cooldown} />
        )}

        <Button block size="lg" onClick={resetForNew}>
          New quick session
        </Button>

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

  // ---------------- SETUP VIEW ----------------
  return (
    <main className="flex flex-col gap-5 p-4">
      <header>
        <h1 className="text-xl font-bold">Train now</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Exercise ideas for right now, based on whatever you have on hand.
        </p>
      </header>

      {error && (
        <div className="rounded-field border border-error/20 bg-error-bg p-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* STEP 1 — equipment */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">1 · What do you have?</h2>

        <OptionCard
          selected={mode === "saved"}
          disabled={hasSavedGym === false}
          onSelect={() => setMode("saved")}
          title="Use my saved gym"
          desc={
            hasSavedGym === false
              ? "No saved gym yet — set one up first"
              : `${savedCount} item${savedCount === 1 ? "" : "s"} on file`
          }
        />
        <OptionCard
          selected={mode === "photo"}
          onSelect={() => setMode("photo")}
          title="Photo of what I have"
          desc="Snap a band, a couple of dumbbells, a pull-up bar…"
        />
        <OptionCard
          selected={mode === "none"}
          onSelect={() => setMode("none")}
          title="No equipment"
          desc="Bodyweight only"
        />

        {mode === "photo" && (
          <Card className="flex flex-col gap-3 p-3">
            <div
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-field border-2 border-dashed border-border-strong p-4 text-center transition-colors hover:border-accent-border"
            >
              <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-fill text-accent">
                <Camera size={20} strokeWidth={1.8} />
              </div>
              <p className="text-sm font-medium text-ink">Tap to add 1–10 photos</p>
              <p className="mt-0.5 text-xs text-ink-tertiary">JPEG, PNG, or HEIC</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {photos.map((p, i) => (
                  <div key={p.previewUrl} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt={`Photo ${i + 1}`}
                      className="h-full w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-white"
                      aria-label="Remove photo"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length > 0 && (
              <Button block loading={recognizing} onClick={handleRecognize}>
                {recognizing
                  ? "Looking…"
                  : recognized
                    ? "Re-scan photos"
                    : "Scan photos"}
              </Button>
            )}

            {recognized && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-ink-secondary">
                  {recognized.length > 0
                    ? "Found — tweak if needed:"
                    : "Nothing recognized. Add items, or continue for a bodyweight session."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {recognized.map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken px-2.5 py-1 text-xs text-ink-secondary"
                    >
                      {item.name}
                      <button
                        type="button"
                        onClick={() => removeRecognized(i)}
                        className="text-ink-tertiary hover:text-ink"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRecognizedItem();
                      }
                    }}
                    placeholder="Add item"
                    className="flex-1 !py-2"
                  />
                  <Button variant="secondary" onClick={addRecognizedItem}>
                    Add
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </section>

      {/* STEP 2 — focus */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">2 · What do you want to train?</h2>
        <SegmentControl
          options={SESSION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          value={sessionType}
          onChange={(v) => changeSessionType(v as SessionType)}
        />
        <PillGroup>
          {chipsForSessionType(sessionType).map((chip) => (
            <Pill
              key={chip}
              selected={selectedChips.includes(chip)}
              onClick={() => toggleChip(chip)}
            >
              {chip}
            </Pill>
          ))}
        </PillGroup>
        <Textarea
          value={focusText}
          onChange={(e) => setFocusText(e.target.value)}
          placeholder={
            sessionType === "cardio"
              ? "…or describe it (e.g. “easy 20 min, knees are cranky”, “treadmill intervals”)"
              : "…or describe it (e.g. “ankle after a sprain”, “stiff neck from sitting”, “legs but easy on the knees”)"
          }
          rows={2}
        />
      </section>

      {/* STEP 3 — time */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">3 · How much time?</h2>
        <SegmentControl
          options={TIME_OPTIONS.map((opt) => ({
            value: String(opt.value),
            label: opt.label,
          }))}
          value={String(timeMin)}
          onChange={(v) => setTimeMin(Number(v) as 10 | 20 | 30 | 45)}
        />
      </section>

      <Button block size="lg" disabled={buildDisabled} loading={building} onClick={handleBuild}>
        {building ? "Building…" : "Suggest exercises"}
      </Button>

      {mode === "photo" && recognized === null && (
        <p className="-mt-2 text-xs text-ink-tertiary">
          Scan your photos first, or switch to another option.
        </p>
      )}

      {building && (
        <div className="flex items-center gap-2 rounded-field border border-accent-badge-border bg-accent-fill p-3 text-sm text-accent-hover">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent border-t-transparent [animation:spin_0.7s_linear_infinite]" />
          {BUILD_MESSAGES[buildIndex]}
        </div>
      )}

      {history.length > 0 && (
        <section className="mt-2 flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Recent</h2>
          <ul className="flex flex-col gap-2">
            {history.map((item) => (
              <li key={item.id}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-ink-tertiary">
                      {item.timeMin} min ·{" "}
                      {item.equipmentMode === "none"
                        ? "bodyweight"
                        : item.equipmentMode === "saved"
                          ? "saved gym"
                          : "photo"}
                      {item.focusChips.length > 0 ? ` · ${item.focusChips.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      onClick={() => openHistory(item)}
                      className="!px-3 !py-1.5 !text-xs"
                    >
                      Open
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => repeat(item)}
                      className="!px-3 !py-1.5 !text-xs"
                    >
                      Repeat
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function SegmentCard({ title, segments }: { title: string; segments: Segment[] }) {
  return (
    <Card className="p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <ul className="flex flex-col gap-2">
        {segments.map((s, i) => (
          <li key={i} className="text-sm">
            <p className="font-medium">
              {s.name}{" "}
              <span className="font-normal text-ink-tertiary">· {s.durationOrReps}</span>
            </p>
            <p className="text-xs text-ink-secondary">{s.howTo}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
