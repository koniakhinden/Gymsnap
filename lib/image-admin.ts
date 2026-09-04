// Query layer for the local image workbench (/admin/images).
//
// Deliberately assembles the queue in memory from three flat reads rather than
// a filtered three-way join: the library is ~900 rows, this runs on a laptop
// against a local tool, and the straightforward version is far easier to keep
// correct as filters get added.

import { desc, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  days,
  exerciseEntries,
  exerciseImageSpecs,
  exerciseImages,
  exercises,
  quickWorkouts,
  weeks,
} from "./db/schema";
import { IMAGE_COST_USD, sizeForSpec, type Quality } from "./image-generation";

export type QueueFilter =
  | "all"
  | "no-spec"
  | "no-image"
  | "pending"
  | "rejected"
  | "ready";

export type QueueRow = {
  id: string;
  name: string;
  equipment: string | null;
  category: string | null;
  phases: number | null;
  orientation: string | null;
  camera: string | null;
  editedByHand: boolean;
  /** Where this exercise stands: drives the queue filters. */
  state: "no-spec" | "no-image" | "pending" | "rejected" | "ready";
  activeUrl: string | null;
  pendingUrl: string | null;
  pendingImageId: string | null;
  size: string | null;
  versions: number;
};

export async function loadQueue(): Promise<QueueRow[]> {
  const [exRows, specRows, imgRows] = await Promise.all([
    db.select().from(exercises),
    db.select().from(exerciseImageSpecs),
    db.select().from(exerciseImages).orderBy(desc(exerciseImages.version)),
  ]);

  const specById = new Map(specRows.map((s) => [s.exerciseId, s]));
  const imgsById = new Map<string, typeof imgRows>();
  for (const img of imgRows) {
    const arr = imgsById.get(img.exerciseId) ?? [];
    arr.push(img);
    imgsById.set(img.exerciseId, arr);
  }

  return exRows
    .map((ex): QueueRow => {
      const spec = specById.get(ex.id) ?? null;
      const imgs = imgsById.get(ex.id) ?? [];
      const active = imgs.find((i) => i.status === "active") ?? null;
      const pending = imgs.find((i) => i.status === "pending") ?? null;

      // Order matters: awaiting review outranks "ready", because a pending row
      // is the thing that needs a human. "rejected" only shows when nothing
      // better exists, so a rejected v1 stops nagging once v2 is approved.
      const state: QueueRow["state"] = !spec
        ? "no-spec"
        : pending
          ? "pending"
          : active
            ? "ready"
            : imgs.some((i) => i.status === "rejected")
              ? "rejected"
              : "no-image";

      return {
        id: ex.id,
        name: ex.name,
        equipment: ex.equipment,
        category: ex.category,
        phases: spec?.phases ?? null,
        orientation: spec?.orientation ?? null,
        camera: spec?.camera ?? null,
        editedByHand: spec?.editedByHand ?? false,
        state,
        activeUrl: active?.url ?? null,
        pendingUrl: pending?.url ?? null,
        pendingImageId: pending?.id ?? null,
        size: spec ? sizeForSpec(spec) : null,
        versions: imgs.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterQueue(
  rows: QueueRow[],
  opts: { filter?: QueueFilter; equipment?: string; category?: string; q?: string }
): QueueRow[] {
  const q = opts.q?.trim().toLowerCase();
  return rows.filter((r) => {
    if (opts.filter && opts.filter !== "all" && r.state !== opts.filter) return false;
    if (opts.equipment && (r.equipment ?? "") !== opts.equipment) return false;
    if (opts.category && (r.category ?? "") !== opts.category) return false;
    if (q && !r.name.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

export type SpendStats = {
  today: number;
  total: number;
  byQuality: Record<string, number>;
  estimatedTodayUsd: number;
  estimatedTotalUsd: number;
};

/**
 * Rough spend, computed from our own row count times a per-tier constant.
 * This is an ESTIMATE, not billing: it can't see failed calls that were still
 * charged, price changes, or anything generated outside this tool.
 */
export async function loadSpend(): Promise<SpendStats> {
  const rows = await db
    .select({ quality: exerciseImages.quality, createdAt: exerciseImages.createdAt })
    .from(exerciseImages)
    .where(inArray(exerciseImages.source, ["generated"]));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const byQuality: Record<string, number> = {};
  let today = 0;
  let estimatedTodayUsd = 0;
  let estimatedTotalUsd = 0;

  for (const r of rows) {
    // Rows written before the quality column existed are priced at the tier we
    // ran everything on, so old renders don't silently count as free.
    const q = (r.quality ?? "high") as Quality;
    byQuality[q] = (byQuality[q] ?? 0) + 1;
    const cost = IMAGE_COST_USD[q] ?? 0;
    estimatedTotalUsd += cost;
    if (r.createdAt && new Date(r.createdAt) >= startOfToday) {
      today += 1;
      estimatedTodayUsd += cost;
    }
  }

  return {
    today,
    total: rows.length,
    byQuality,
    estimatedTodayUsd,
    estimatedTotalUsd,
  };
}


export type UsageRow = {
  id: string;
  name: string;
  /** Prescribed as a main exercise in a plan — the strongest signal. */
  prescribed: number;
  /** Offered as an occupied-equipment backup (shown behind a button). */
  alternates: number;
  /** Warmup and weekly stretch items. */
  routine: number;
  /** Blocks inside saved "Train now" sessions. */
  quick: number;
  total: number;
};

/**
 * How often each exercise has actually been handed to a user.
 *
 * Used to spend the illustration budget where it shows: a few hundred moves
 * carry almost every plan, and the long tail of the library may never be seen.
 * Ranked by `prescribed` first because a main prescribed exercise is what the
 * user actually trains; alternates and warmups break ties.
 */
export async function loadUsageRanking(): Promise<UsageRow[]> {
  const [exRows, entryRows, dayRows, weekRows, quickRows] = await Promise.all([
    db.select({ id: exercises.id, name: exercises.name }).from(exercises),
    db
      .select({
        exerciseId: exerciseEntries.exerciseId,
        alternatives: exerciseEntries.alternatives,
      })
      .from(exerciseEntries),
    db.select({ warmupItems: days.warmupItems }).from(days),
    db.select({ stretchBlocks: weeks.stretchBlocks }).from(weeks),
    db.select({ result: quickWorkouts.result }).from(quickWorkouts),
  ]);

  const counts = new Map<string, UsageRow>();
  const nameById = new Map(exRows.map((e) => [e.id, e.name]));
  const bump = (id: string | null | undefined, field: keyof UsageRow) => {
    // Only count ids that exist in the library — a plan can reference a
    // hand-written name or an id Claude invented, and neither can be drawn.
    if (!id || !nameById.has(id)) return;
    const row =
      counts.get(id) ??
      ({
        id,
        name: nameById.get(id) as string,
        prescribed: 0,
        alternates: 0,
        routine: 0,
        quick: 0,
        total: 0,
      } satisfies UsageRow);
    (row[field] as number) += 1;
    row.total += 1;
    counts.set(id, row);
  };

  for (const e of entryRows) {
    bump(e.exerciseId, "prescribed");
    for (const a of e.alternatives ?? []) bump(a.exerciseId, "alternates");
  }
  for (const d of dayRows) {
    for (const w of d.warmupItems ?? []) bump(w.exerciseId, "routine");
  }
  for (const w of weekRows) {
    for (const b of w.stretchBlocks ?? []) {
      for (const it of b.items ?? []) bump(it.exerciseId, "routine");
    }
  }
  for (const q of quickRows) {
    const blocks = (q.result as { blocks?: { exerciseId?: string | null }[] } | null)?.blocks;
    for (const b of blocks ?? []) bump(b.exerciseId, "quick");
  }

  return [...counts.values()].sort(
    (a, b) => b.prescribed - a.prescribed || b.total - a.total || a.name.localeCompare(b.name)
  );
}
