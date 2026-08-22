"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Plus, Dumbbell } from "lucide-react";
import { Modal, Input, cn } from "@/components/ui";

export type ExerciseOption = {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
};

export type PickedExercise = { exerciseId: string | null; nameOverride: string | null };

// Broad, user-facing muscle groups mapped onto the library's fine-grained
// primaryMuscles. "Back" bundles lats/traps/lower+middle back, etc.
const MUSCLE_GROUPS: { key: string; label: string; muscles: string[] }[] = [
  { key: "chest", label: "Chest", muscles: ["chest"] },
  { key: "back", label: "Back", muscles: ["lats", "middle back", "lower back", "traps"] },
  { key: "shoulders", label: "Shoulders", muscles: ["shoulders", "neck"] },
  { key: "arms", label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { key: "legs", label: "Legs", muscles: ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"] },
  { key: "core", label: "Core", muscles: ["abdominals"] },
];

const EQUIP_LABEL: Record<string, string> = {
  "body only": "Bodyweight",
  cable: "Cable",
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

function equipKey(e: string | null): string {
  return e ?? "none";
}
function equipLabel(e: string | null): string {
  return e ? EQUIP_LABEL[e] ?? e : "Bodyweight / other";
}

function RowButton({
  children,
  onClick,
  chevron = true,
}: {
  children: React.ReactNode;
  onClick: () => void;
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-field border border-border bg-surface px-3.5 text-left text-sm font-medium text-ink transition-colors hover:border-accent-border hover:bg-accent-fill/40"
    >
      <span className="min-w-0 flex-1">{children}</span>
      {chevron && <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-ink-tertiary" />}
    </button>
  );
}

/**
 * Micro-tree exercise picker: choose a muscle group -> the equipment your gym
 * actually has for it -> a specific exercise. Or type to search across every
 * available exercise (autocomplete) and pick from the matches, or add whatever
 * you typed as a custom movement. `options` is already filtered to the user's
 * equipment by the server, so nothing here can offer a movement they can't do.
 */
export default function ExercisePicker({
  open,
  title,
  options,
  loading = false,
  submitting = false,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  options: ExerciseOption[];
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onPick: (sel: PickedExercise) => void;
}) {
  const [query, setQuery] = useState("");
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null | undefined>(undefined); // undefined = not chosen

  function reset() {
    setQuery("");
    setGroupKey(null);
    setEquip(undefined);
  }
  function handleClose() {
    reset();
    onClose();
  }

  const group = MUSCLE_GROUPS.find((g) => g.key === groupKey) ?? null;

  // Options for the chosen muscle group.
  const groupOptions = useMemo(() => {
    if (!group) return [];
    const set = new Set(group.muscles);
    return options.filter((o) => o.primaryMuscles.some((m) => set.has(m)));
  }, [group, options]);

  // Which muscle groups actually have exercises available (hide empty ones).
  const nonEmptyGroups = useMemo(() => {
    return MUSCLE_GROUPS.filter((g) => {
      const set = new Set(g.muscles);
      return options.some((o) => o.primaryMuscles.some((m) => set.has(m)));
    });
  }, [options]);

  // Distinct equipment within the chosen group, most-common first.
  const equipChoices = useMemo(() => {
    const counts = new Map<string, { key: string; equipment: string | null; count: number }>();
    for (const o of groupOptions) {
      const k = equipKey(o.equipment);
      const cur = counts.get(k);
      if (cur) cur.count++;
      else counts.set(k, { key: k, equipment: o.equipment, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [groupOptions]);

  const exerciseList = useMemo(() => {
    if (equip === undefined) return [];
    return groupOptions
      .filter((o) => equipKey(o.equipment) === equipKey(equip ?? null))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groupOptions, equip]);

  // Free-text search across everything (autocomplete).
  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return options
      .filter((o) => o.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [q, options]);

  const exactMatch = q ? options.some((o) => o.name.toLowerCase() === q) : false;

  function pickLibrary(id: string) {
    onPick({ exerciseId: id, nameOverride: null });
  }
  function pickCustom(name: string) {
    const n = name.trim();
    if (n) onPick({ exerciseId: null, nameOverride: n });
  }

  return (
    <Modal open={open} onClose={handleClose} title={title} icon={Dumbbell} tone="accent">
      {/* Search / autocomplete — always available, overrides the tree when typed. */}
      <div className="relative mb-3">
        <Search
          size={16}
          strokeWidth={2}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises, or type your own…"
          className="!pl-9"
          autoFocus
        />
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-ink-tertiary">Loading exercises…</p>
      ) : q ? (
        // ---- Search mode ----
        <div className="flex flex-col gap-2">
          {searchResults.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={submitting}
              onClick={() => pickLibrary(o.id)}
              className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-field border border-border bg-surface px-3.5 text-left text-sm text-ink transition-colors hover:border-accent-border hover:bg-accent-fill/40 disabled:opacity-50"
            >
              <span className="min-w-0 flex-1 font-medium">{o.name}</span>
              <span className="shrink-0 text-xs text-ink-tertiary">{equipLabel(o.equipment)}</span>
            </button>
          ))}
          {!exactMatch && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => pickCustom(query)}
              className="flex min-h-[48px] w-full items-center gap-2 rounded-field border border-dashed border-accent-border bg-accent-fill/30 px-3.5 text-left text-sm font-semibold text-accent transition-colors hover:bg-accent-fill/60 disabled:opacity-50"
            >
              <Plus size={16} strokeWidth={2.5} className="shrink-0" />
              Add “{query.trim()}” as a custom exercise
            </button>
          )}
          {searchResults.length === 0 && exactMatch && (
            <p className="py-4 text-center text-sm text-ink-tertiary">No matches.</p>
          )}
        </div>
      ) : equip !== undefined ? (
        // ---- Step 3: exercises for group + equipment ----
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setEquip(undefined)}
            className="mb-1 inline-flex min-h-[36px] items-center gap-1 self-start text-[13px] font-semibold text-ink-secondary hover:text-ink"
          >
            <ChevronLeft size={16} strokeWidth={2} />
            {group?.label} · {equipLabel(equip ?? null)}
          </button>
          {exerciseList.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={submitting}
              onClick={() => pickLibrary(o.id)}
              className="min-h-[48px] w-full rounded-field border border-border bg-surface px-3.5 text-left text-sm font-medium text-ink transition-colors hover:border-accent-border hover:bg-accent-fill/40 disabled:opacity-50"
            >
              {o.name}
            </button>
          ))}
        </div>
      ) : group ? (
        // ---- Step 2: equipment available for the group ----
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setGroupKey(null)}
            className="mb-1 inline-flex min-h-[36px] items-center gap-1 self-start text-[13px] font-semibold text-ink-secondary hover:text-ink"
          >
            <ChevronLeft size={16} strokeWidth={2} />
            {group.label}
          </button>
          {equipChoices.map((c) => (
            <RowButton key={c.key} onClick={() => setEquip(c.equipment)}>
              <span className="flex items-center justify-between gap-2">
                <span>{equipLabel(c.equipment)}</span>
                <span className="text-xs font-normal text-ink-tertiary">{c.count}</span>
              </span>
            </RowButton>
          ))}
        </div>
      ) : (
        // ---- Step 1: muscle group ----
        <div className="grid grid-cols-2 gap-2">
          {nonEmptyGroups.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGroupKey(g.key)}
              className={cn(
                "flex min-h-[56px] items-center justify-center rounded-field border border-border bg-surface px-3 text-center text-sm font-semibold text-ink transition-colors hover:border-accent-border hover:bg-accent-fill/40",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
