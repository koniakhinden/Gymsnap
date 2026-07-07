"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type EquipmentCategory = "cardio" | "strength_machine" | "free_weights" | "accessories";
type Confidence = "high" | "medium" | "low";

type EditableItem = {
  name: string;
  category: EquipmentCategory;
  details: string;
  confidence: Confidence;
  source: "recognized" | "manual";
};

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  cardio: "Cardio",
  strength_machine: "Strength machine",
  free_weights: "Free weights",
  accessories: "Accessories",
};

export default function ConfirmEquipmentPage() {
  const router = useRouter();
  const [items, setItems] = useState<EditableItem[] | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("gymsnap:recognized");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Items coming from recognition don't carry a `source` — default it,
        // the save API requires 'recognized' | 'manual' on every item.
        setItems(
          (parsed.items ?? []).map((it: Partial<EditableItem>) => ({
            source: "recognized" as const,
            ...it,
          }))
        );
        setPhotoUrls(parsed.photoUrls ?? []);
        return;
      } catch {
        // fall through to loading the saved gym
      }
    }
    // No fresh recognition in this session — load the last saved gym so the
    // user can review and edit it. Saving creates a new gym snapshot.
    fetch("/api/gym")
      .then((r) => r.json())
      .then((data) => {
        const saved = (data?.items ?? []) as Array<Partial<EditableItem>>;
        setItems(
          saved.map((it) => ({
            name: it.name ?? "",
            category: (it.category as EditableItem["category"]) ?? "accessories",
            details: it.details ?? "",
            confidence: (it.confidence as EditableItem["confidence"]) ?? "high",
            source: (it.source as EditableItem["source"]) ?? "recognized",
          }))
        );
      })
      .catch(() => setItems([]));
  }, []);

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  }

  function addManualItem() {
    setItems((prev) => [
      ...(prev ?? []),
      { name: "", category: "accessories", details: "", confidence: "high", source: "manual" },
    ]);
  }

  async function handleSave() {
    if (!items || items.length === 0) {
      setError("Add at least one piece of equipment before saving.");
      return;
    }
    if (items.some((i) => i.name.trim() === "")) {
      setError("Every item needs a name. Remove blank entries or fill them in.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, photoUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      sessionStorage.removeItem("gymsnap:recognized");
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  if (items === null) {
    return <main className="p-4">Loading...</main>;
  }

  if (items.length === 0) {
    return (
      <main className="p-4 flex flex-col gap-3">
        <h1 className="text-xl font-bold">Nothing to confirm yet</h1>
        <p className="text-sm text-gray-500">
          Go back to Setup and recognize your gym equipment first.
        </p>
        <Link href="/setup" className="rounded-lg bg-gray-900 text-white py-3 text-center font-semibold">
          Go to Setup
        </Link>
      </main>
    );
  }

  return (
    <main className="p-4 flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">Confirm your equipment</h1>
        <p className="text-sm text-gray-500 mt-1">
          Edit, remove, or add items so the list matches your gym exactly.
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div
            key={i}
            className={`rounded-xl border p-3 flex flex-col gap-2 ${
              item.confidence === "low"
                ? "border-yellow-300 bg-yellow-50"
                : "border-gray-200 bg-white"
            }`}
          >
            {item.confidence === "low" && (
              <p className="text-xs font-semibold text-yellow-700">Please verify</p>
            )}
            <input
              value={item.name}
              onChange={(e) => updateItem(i, { name: e.target.value })}
              placeholder="Equipment name"
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm font-medium"
            />
            <div className="flex gap-2">
              <select
                value={item.category}
                onChange={(e) =>
                  updateItem(i, { category: e.target.value as EquipmentCategory })
                }
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="rounded-md border border-gray-300 px-3 text-sm text-red-600"
              >
                Delete
              </button>
            </div>
            <input
              value={item.details}
              onChange={(e) => updateItem(i, { details: e.target.value })}
              placeholder="Details (e.g. weight range)"
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-600"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addManualItem}
        className="rounded-lg border border-dashed border-gray-400 py-2.5 text-sm font-medium text-gray-600"
      >
        + Add equipment manually
      </button>

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="rounded-lg bg-gray-900 text-white py-3 font-semibold disabled:opacity-40"
      >
        {saving ? "Saving..." : "Save gym setup"}
      </button>
    </main>
  );
}
