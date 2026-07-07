"use client";

import { useEffect, useRef, useState } from "react";
import ImageLightbox, { exerciseImageUrl } from "@/components/ImageLightbox";
import { compressPhoto } from "@/lib/compress-photo";

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
  exercise: { id: string; name: string; images: string[]; equipment: string | null } | null;
};
type Segment = { name: string; howTo: string; durationOrReps: string };
type Workout = {
  title: string;
  focus: string;
  totalMin: number;
  warmup: Segment[];
  blocks: Block[];
  cooldown: Segment[];
  cautions: string[];
};

type HistoryItem = {
  id: number;
  createdAt: string;
  equipmentMode: EquipmentMode;
  equipment: EquipmentItem[];
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
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [focusText, setFocusText] = useState("");

  // ---- time step ----
  const [timeMin, setTimeMin] = useState<10 | 20 | 30 | 45>(20);

  // ---- generation / result ----
  const [building, setBuilding] = useState(false);
  const [buildIndex, setBuildIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [expanded, setExpanded] = useState<Record<number, "easier" | "harder" | null>>({});
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
      const res = await fetch("/api/quick-workout");
      const data = await res.json();
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

  async function handleBuild() {
    setError(null);
    // photo mode requires a confirmed list
    const equipmentItems =
      mode === "photo" ? recognized ?? [] : [];
    setBuilding(true);
    setBuildIndex(0);
    setWorkout(null);
    try {
      const res = await fetch("/api/quick-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentMode: mode,
          equipmentItems,
          focusChips: selectedChips,
          focusText,
          timeMin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build workout.");
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
      const res = await fetch(`/api/quick-workout/${item.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load the workout.");
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
      <main className="p-4 flex flex-col gap-4">
        <header>
          <h1 className="text-xl font-bold">{workout.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {workout.focus} · ~{workout.totalMin} min
          </p>
        </header>

        {workout.cautions.length > 0 && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3">
            <p className="font-semibold mb-1">Before you start</p>
            <ul className="list-disc pl-4 space-y-1">
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
              <div key={i} className="rounded-xl bg-white border border-gray-200 p-4">
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
                        className="h-16 w-16 object-cover rounded-md border border-gray-200"
                      />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm">
                        {i + 1}. {name}
                      </p>
                      <span className="shrink-0 text-xs rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">
                        {blockBadge(block)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {block.sets} sets × {block.reps} · rest {block.restSec}s
                    </p>
                    {block.whyIncluded && (
                      <p className="text-xs text-gray-400 mt-1">{block.whyIncluded}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  {block.easierOption && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((p) => ({ ...p, [i]: open === "easier" ? null : "easier" }))
                      }
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${
                        open === "easier"
                          ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                          : "border-gray-300 text-gray-600"
                      }`}
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
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${
                        open === "harder"
                          ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                          : "border-gray-300 text-gray-600"
                      }`}
                    >
                      Harder
                    </button>
                  )}
                </div>
                {open && (
                  <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">
                    {open === "easier" ? block.easierOption : block.harderOption}
                  </p>
                )}
              </div>
            );
          })}
        </section>

        {workout.cooldown.length > 0 && (
          <SegmentCard title="Cooldown" segments={workout.cooldown} />
        )}

        <button
          type="button"
          onClick={resetForNew}
          className="rounded-lg bg-gray-900 text-white py-3 font-semibold"
        >
          New quick workout
        </button>

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
    <main className="p-4 flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold">Train now</h1>
        <p className="text-sm text-gray-500 mt-1">
          Get one session for right now, built from whatever you have on hand.
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </div>
      )}

      {/* STEP 1 — equipment */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm">1 · What do you have?</h2>

        <ModeOption
          active={mode === "saved"}
          disabled={hasSavedGym === false}
          onClick={() => setMode("saved")}
          title="Use my saved gym"
          subtitle={
            hasSavedGym === false
              ? "No saved gym yet — set one up first"
              : `${savedCount} item${savedCount === 1 ? "" : "s"} on file`
          }
        />
        <ModeOption
          active={mode === "photo"}
          onClick={() => setMode("photo")}
          title="Photo of what I have"
          subtitle="Snap a band, a couple of dumbbells, a pull-up bar…"
        />
        <ModeOption
          active={mode === "none"}
          onClick={() => setMode("none")}
          title="No equipment"
          subtitle="Bodyweight only"
        />

        {mode === "photo" && (
          <div className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col gap-3">
            <div
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center cursor-pointer"
            >
              <p className="text-2xl mb-1">📷</p>
              <p className="text-sm font-medium text-gray-700">Tap to add 1–10 photos</p>
              <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG, or HEIC</p>
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
                      className="h-full w-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                      aria-label="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length > 0 && (
              <button
                type="button"
                disabled={recognizing}
                onClick={handleRecognize}
                className="rounded-lg bg-gray-900 text-white py-2 text-sm font-semibold disabled:opacity-40"
              >
                {recognizing
                  ? "Looking…"
                  : recognized
                  ? "Re-scan photos"
                  : "Scan photos"}
              </button>
            )}

            {recognized && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-gray-500">
                  {recognized.length > 0
                    ? "Found — tweak if needed:"
                    : "Nothing recognized. Add items, or continue for a bodyweight session."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {recognized.map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 text-xs px-2.5 py-1"
                    >
                      {item.name}
                      <button
                        type="button"
                        onClick={() => removeRecognized(i)}
                        className="text-gray-400"
                        aria-label={`Remove ${item.name}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRecognizedItem();
                      }
                    }}
                    placeholder="Add item"
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addRecognizedItem}
                    className="rounded-md border border-gray-300 px-3 text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* STEP 2 — focus */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm">2 · What do you want to train?</h2>
        <div className="flex flex-wrap gap-2">
          {FOCUS_CHIPS.map((chip) => {
            const on = selectedChips.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => toggleChip(chip)}
                className={`rounded-full px-3 py-1.5 text-sm border ${
                  on
                    ? "border-cyan-500 bg-cyan-50 text-cyan-700 font-medium"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
        <textarea
          value={focusText}
          onChange={(e) => setFocusText(e.target.value)}
          placeholder="…or describe it (e.g. “ankle after a sprain”, “stiff neck from sitting”, “legs but easy on the knees”)"
          rows={2}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </section>

      {/* STEP 3 — time */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm">3 · How much time?</h2>
        <div className="grid grid-cols-4 gap-2">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTimeMin(opt.value)}
              className={`rounded-lg py-2.5 text-sm font-medium border ${
                timeMin === opt.value
                  ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={buildDisabled}
        onClick={handleBuild}
        className="rounded-lg bg-gray-900 text-white py-3 font-semibold disabled:opacity-40"
      >
        {building ? "Building…" : "Build my workout"}
      </button>

      {mode === "photo" && recognized === null && (
        <p className="text-xs text-gray-400 -mt-2">
          Scan your photos first, or switch to another option.
        </p>
      )}

      {building && (
        <div className="rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 text-sm p-3 flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-600 border-t-transparent animate-spin" />
          {BUILD_MESSAGES[buildIndex]}
        </div>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2 mt-2">
          <h2 className="font-semibold text-sm">Recent</h2>
          <ul className="flex flex-col gap-2">
            {history.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-gray-200 bg-white p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {item.timeMin} min ·{" "}
                    {item.equipmentMode === "none"
                      ? "bodyweight"
                      : item.equipmentMode === "saved"
                      ? "saved gym"
                      : "photo"}
                    {item.focusChips.length > 0 ? ` · ${item.focusChips.join(", ")}` : ""}
                  </p>
                </div>
                <div className="shrink-0 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openHistory(item)}
                    className="rounded-lg bg-gray-900 text-white px-3 py-1.5 text-xs font-medium"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => repeat(item)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium"
                  >
                    Repeat
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function ModeOption({
  active,
  disabled,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`text-left rounded-xl border p-3 flex items-center gap-3 disabled:opacity-50 ${
        active ? "border-cyan-500 bg-cyan-50" : "border-gray-200 bg-white"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full border-2 shrink-0 ${
          active ? "border-cyan-500 bg-cyan-500" : "border-gray-300"
        }`}
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-gray-500">{subtitle}</span>
      </span>
    </button>
  );
}

function SegmentCard({ title, segments }: { title: string; segments: Segment[] }) {
  return (
    <section className="rounded-xl bg-white border border-gray-200 p-4">
      <h2 className="font-semibold text-sm mb-2">{title}</h2>
      <ul className="flex flex-col gap-2">
        {segments.map((s, i) => (
          <li key={i} className="text-sm">
            <p className="font-medium">
              {s.name} <span className="text-gray-400 font-normal">· {s.durationOrReps}</span>
            </p>
            <p className="text-xs text-gray-500">{s.howTo}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
