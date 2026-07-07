"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  buttonClass,
  Card,
  Input,
  Select,
  Skeleton,
  SkeletonCardRow,
} from "@/components/ui";

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
    return (
      <main className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <SkeletonCardRow />
        <SkeletonCardRow />
        <SkeletonCardRow />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="flex flex-col gap-3 p-4">
        <h1 className="text-xl font-bold">Nothing to confirm yet</h1>
        <p className="text-sm text-ink-secondary">
          Go back to Setup and recognize your gym equipment first.
        </p>
        <Link href="/setup" className={buttonClass({ block: true, size: "lg" })}>
          Go to Setup
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-bold">Confirm your equipment</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Edit, remove, or add items so the list matches your gym exactly.
        </p>
      </header>

      {error && (
        <div className="rounded-field border border-error/20 bg-error-bg p-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <Card
            key={i}
            className={`flex flex-col gap-2 p-3 ${
              item.confidence === "low" ? "border-warning/40 bg-warning-bg" : ""
            }`}
          >
            {item.confidence === "low" && (
              <p className="text-xs font-semibold text-warning-ink">Please verify</p>
            )}
            <Input
              value={item.name}
              onChange={(e) => updateItem(i, { name: e.target.value })}
              placeholder="Equipment name"
              className="!py-2 font-medium"
            />
            <div className="flex gap-2">
              <Select
                value={item.category}
                onChange={(e) =>
                  updateItem(i, { category: e.target.value as EquipmentCategory })
                }
                className="!py-2"
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                onClick={() => removeItem(i)}
                aria-label="Delete"
                className="!px-3 !py-2 !text-sm !text-error hover:!border-error/40"
              >
                <Trash2 size={16} strokeWidth={2} />
                Delete
              </Button>
            </div>
            <Input
              value={item.details}
              onChange={(e) => updateItem(i, { details: e.target.value })}
              placeholder="Details (e.g. weight range)"
              className="!py-2 !text-ink-secondary"
            />
          </Card>
        ))}
      </div>

      <button
        type="button"
        onClick={addManualItem}
        className="flex items-center justify-center gap-1.5 rounded-btn border border-dashed border-border-strong py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:border-ink-disabled hover:bg-surface"
      >
        <Plus size={16} strokeWidth={2} />
        Add equipment manually
      </button>

      <Button block size="lg" loading={saving} onClick={handleSave}>
        {saving ? "Saving..." : "Save gym setup"}
      </Button>
    </main>
  );
}
