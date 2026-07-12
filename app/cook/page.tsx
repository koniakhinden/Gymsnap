"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, X, Plus, ChevronRight } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  SegmentControl,
  Select,
  Stepper,
  Textarea,
} from "@/components/ui";
import { compressPhoto } from "@/lib/compress-photo";
import { fetchJson } from "@/lib/safe-fetch";

type Source = "photo" | "manual";
type MealType = "any" | "breakfast" | "lunch" | "dinner" | "snack";
type Ingredient = { name: string };
type PickedPhoto = { file: File; previewUrl: string };

type Recipe = {
  name: string;
  description: string;
  servings: number;
  timeMin: number;
  ingredientsUsed: { name: string; amount: string }[];
  missingItems: string[];
  steps: string[];
  macrosPerServing: { calories: number; proteinG: number; fatG: number; carbG: number };
};
type Meal = { title: string; recipes: Recipe[]; cautions: string[] };
type HistoryItem = {
  id: number;
  createdAt: string;
  source: Source;
  mealType: string;
  servings: number;
  title: string;
};

const MAX_FILES = 10;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".heic", ".heif"];
const isAccepted = (f: File) => ACCEPTED_EXT.some((e) => f.name.toLowerCase().endsWith(e));

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

const BUILD_MESSAGES = [
  "Looking at what you have...",
  "Matching it to your tastes...",
  "Writing the recipe...",
];

export default function CookPage() {
  const [source, setSource] = useState<Source>("manual");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [recognizing, setRecognizing] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIng, setNewIng] = useState("");
  const [mealType, setMealType] = useState<MealType>("any");
  const [servings, setServings] = useState(2);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [building, setBuilding] = useState(false);
  const [buildIndex, setBuildIndex] = useState(0);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const data = await fetchJson<{ history?: HistoryItem[] }>("/api/cook");
      setHistory(data.history ?? []);
    } catch {
      /* non-critical */
    }
  }

  function addFiles(list: FileList | File[]) {
    setError(null);
    const accepted: PickedPhoto[] = [];
    for (const file of Array.from(list)) {
      if (!isAccepted(file)) {
        setError(`Unsupported file: ${file.name}. Use JPEG, PNG, or HEIC.`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setPhotos((prev) => [...prev, ...accepted].slice(0, MAX_FILES));
  }

  function removePhoto(i: number) {
    setPhotos((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[i].previewUrl);
      copy.splice(i, 1);
      return copy;
    });
  }

  async function handleRecognize() {
    if (photos.length === 0) return;
    setRecognizing(true);
    setError(null);
    try {
      const compressed = await Promise.all(photos.map((p) => compressPhoto(p.file)));
      const form = new FormData();
      for (const f of compressed) form.append("photos", f);
      const res = await fetch("/api/cook/recognize", { method: "POST", body: form });
      const text = await res.text();
      let data: { items?: { name: string }[]; error?: string } | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (!res.ok) throw new Error(data?.error || `Recognition failed (HTTP ${res.status}).`);
      const found = (data?.items ?? []).map((i) => ({ name: i.name }));
      setIngredients((prev) => [...prev, ...found]);
      if (found.length === 0) setError("No ingredients spotted — add some by hand.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRecognizing(false);
    }
  }

  function addIngredient() {
    const name = newIng.trim();
    if (!name) return;
    setIngredients((prev) => [...prev, { name }]);
    setNewIng("");
  }
  function removeIngredient(i: number) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleBuild() {
    setError(null);
    setBuilding(true);
    setBuildIndex(0);
    setMeal(null);
    const timer = setInterval(
      () => setBuildIndex((i) => Math.min(i + 1, BUILD_MESSAGES.length - 1)),
      2500
    );
    try {
      const data = await fetchJson<{ meal: Meal }>("/api/cook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          ingredients: ingredients.map((i) => ({ name: i.name })),
          mealType,
          servings,
          note,
        }),
      });
      setMeal(data.meal);
      window.scrollTo({ top: 0, behavior: "smooth" });
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      clearInterval(timer);
      setBuilding(false);
    }
  }

  async function openHistory(id: number) {
    setError(null);
    try {
      const data = await fetchJson<{ meal: Meal }>(`/api/cook/${id}`);
      setMeal(data.meal);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  // ---------------- RESULT ----------------
  if (meal) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <header>
          <h1 className="text-xl font-bold">{meal.title}</h1>
        </header>

        {meal.cautions.length > 0 && (
          <div className="rounded-field border border-warning/25 bg-warning-bg p-3 text-sm text-warning-ink">
            <ul className="list-disc space-y-1 pl-4">
              {meal.cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {meal.recipes.map((r, i) => (
          <Card key={i} className="flex flex-col gap-2 p-4">
            <div>
              <p className="text-[17px] font-semibold">{r.name}</p>
              <p className="text-xs text-ink-tertiary">
                {r.servings} serving{r.servings === 1 ? "" : "s"} · ~{r.timeMin} min ·{" "}
                {r.macrosPerServing.calories} kcal/serv · {r.macrosPerServing.proteinG}p /{" "}
                {r.macrosPerServing.fatG}f / {r.macrosPerServing.carbG}c
              </p>
            </div>
            {r.description && <p className="text-sm text-ink-secondary">{r.description}</p>}

            {r.ingredientsUsed.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Uses</p>
                <p className="text-[13px] text-ink-secondary">
                  {r.ingredientsUsed.map((u) => `${u.name}${u.amount ? ` (${u.amount})` : ""}`).join(", ")}
                </p>
              </div>
            )}
            {r.missingItems.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">To grab</p>
                <p className="text-[13px] text-ink-secondary">{r.missingItems.join(", ")}</p>
              </div>
            )}

            <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-secondary">
              {r.steps.map((s, si) => (
                <li key={si}>{s}</li>
              ))}
            </ol>
          </Card>
        ))}

        <Button block size="lg" onClick={() => setMeal(null)}>
          Cook something else
        </Button>
      </main>
    );
  }

  // ---------------- SETUP ----------------
  const canBuild = !building && (source === "photo" || ingredients.length > 0);

  return (
    <main className="flex flex-col gap-5 p-4">
      <header>
        <h1 className="text-xl font-bold">Cook now</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          A recipe from what you already have — snap your fridge or type a few ingredients.
        </p>
      </header>

      {error && (
        <div className="rounded-field border border-error/20 bg-error-bg p-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* STEP 1 — ingredients */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">1 · What do you have?</h2>
        <SegmentControl<Source>
          value={source}
          onChange={setSource}
          options={[
            { value: "manual", label: "Type it in" },
            { value: "photo", label: "Photo of fridge" },
          ]}
        />

        {source === "photo" && (
          <Card className="flex flex-col gap-2 p-3">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.previewUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => removePhoto(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-surface"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => inputRef.current?.click()} className="!text-sm">
                <Camera size={16} strokeWidth={2} /> Add photos
              </Button>
              {photos.length > 0 && (
                <Button loading={recognizing} onClick={handleRecognize} className="!text-sm">
                  {recognizing ? "Scanning..." : "Scan photos"}
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Ingredient list (editable, shared by both modes) */}
        <div className="flex gap-2">
          <Input
            value={newIng}
            onChange={(e) => setNewIng(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addIngredient();
              }
            }}
            placeholder="Add an ingredient…"
            className="!py-2"
          />
          <Button variant="secondary" onClick={addIngredient} aria-label="Add">
            <Plus size={16} strokeWidth={2} />
          </Button>
        </div>
        {ingredients.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ingredients.map((ing, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface px-2.5 py-1 text-[13px]"
              >
                {ing.name}
                <button type="button" aria-label={`Remove ${ing.name}`} onClick={() => removeIngredient(i)}>
                  <X size={13} strokeWidth={2.5} className="text-ink-tertiary" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* STEP 2 — meal + servings */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">2 · What kind of meal?</h2>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Meal">
            <Select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
              {MEAL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Servings">
            <Stepper ariaLabel="servings" value={servings} min={1} max={12} step={1} onChange={setServings} />
          </Field>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="…anything else? (e.g. “quick and high-protein”, “no oven”)"
          rows={2}
        />
      </section>

      <Button block size="lg" disabled={!canBuild} loading={building} onClick={handleBuild}>
        {building ? "Cooking up ideas..." : "Suggest a recipe"}
      </Button>

      {building && (
        <div className="flex items-center gap-2 rounded-field border border-accent-badge-border bg-accent-fill p-3 text-sm text-accent-hover">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent border-t-transparent [animation:spin_0.7s_linear_infinite]" />
          {BUILD_MESSAGES[buildIndex]}
        </div>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Recent</h2>
          {history.map((h) => (
            <Card key={h.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{h.title}</p>
                <p className="text-xs text-ink-tertiary">
                  {h.mealType} · {h.servings} serving{h.servings === 1 ? "" : "s"}
                </p>
              </div>
              <Button variant="secondary" onClick={() => openHistory(h.id)} className="!min-h-[40px] !px-3 !text-sm">
                Open
                <ChevronRight size={16} strokeWidth={2} />
              </Button>
            </Card>
          ))}
        </section>
      )}

      <p className="text-center text-[11px] text-ink-tertiary">
        Recipes are ideas only, not nutrition or medical advice. Always respect your allergies.{" "}
        <Link href="/nutrition" className="text-accent underline hover:text-accent-hover">
          Food setup
        </Link>
      </p>
    </main>
  );
}
