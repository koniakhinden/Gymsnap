import { db } from "./db";
import {
  weeks,
  days,
  exerciseEntries,
  exercises,
  exerciseSetLogs,
  checkins,
  dayCheckins,
  profiles,
  gyms,
  equipmentItems,
} from "./db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { CUSTOM_BY_ID } from "./custom-exercises";

export async function getLatestProfile(userId: string) {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .orderBy(desc(profiles.id))
    .limit(1);
  return rows[0];
}

export async function getLatestGymWithEquipment(userId: string) {
  const gymRows = await db
    .select()
    .from(gyms)
    .where(eq(gyms.userId, userId))
    .orderBy(desc(gyms.id))
    .limit(1);
  const gym = gymRows[0];
  if (!gym) return null;
  const items = await db
    .select()
    .from(equipmentItems)
    .where(eq(equipmentItems.gymId, gym.id));
  return { gym, items };
}

export type SetLog = {
  id: number;
  setNumber: number;
  weight: number | null;
  weightUnit: "kg" | "lbs";
  reps: number | null;
  toFailure: boolean;
  loggedAt: string;
};

export type HydratedAlternative = {
  exerciseId: string | null;
  nameOverride: string | null;
  note: string;
  exercise: {
    id: string;
    name: string;
    images: string[];
    equipment: string | null;
  } | null;
};

// A hydrated warmup or stretch move: the stored fields plus any resolved library
// exercise (image + instructions) when it referenced an id.
export type HydratedRoutineItem = {
  exerciseId: string | null;
  nameOverride: string | null;
  howTo: string;
  duration: string;
  exercise: {
    id: string;
    name: string;
    images: string[];
    equipment: string | null;
    instructions: string[];
  } | null;
};

export type HydratedStretchBlock = {
  title: string;
  targetMuscles: string[];
  items: HydratedRoutineItem[];
};

export type FullExerciseEntry = {
  id: number;
  orderIndex: number;
  exerciseId: string | null;
  nameOverride: string | null;
  sets: number;
  reps: string;
  weight: string;
  restSec: number;
  notes: string | null;
  unverified: boolean;
  exercise: {
    id: string;
    name: string;
    images: string[];
    instructions: string[];
    equipment: string | null;
  } | null;
  alternatives: HydratedAlternative[];
  logs: SetLog[];
};

export type FullDay = {
  id: number;
  orderIndex: number;
  dayLabel: string;
  focus: string;
  warmup: string;
  cooldown: string;
  cardio: {
    type: string;
    durationMin: number;
    incline: string | null;
    targetHr: string | null;
  } | null;
  // Minutes of cardio the user actually logged for this day (null = not logged).
  cardioActualMin: number | null;
  // Structured warmup moves (empty for older weeks that only have warmup text).
  warmupItems: HydratedRoutineItem[];
  exercises: FullExerciseEntry[];
  checkinStatus: "completed" | "partial" | "skipped" | null;
};

export type FullWeek = {
  id: number;
  weekNumber: number;
  createdAt: string;
  days: FullDay[];
  // 2-3 optional weekly stretch blocks (empty for older weeks).
  stretchBlocks: HydratedStretchBlock[];
  checkin: {
    id: number;
    overallComment: string | null;
    wellbeing: number;
    kneesRating: number;
    lowerBackRating: number;
  } | null;
};

type StoredRoutineItem = {
  exerciseId: string | null;
  nameOverride: string | null;
  howTo: string;
  duration: string;
};

type LibExercise = {
  id: string;
  name: string;
  images: string[];
  equipment: string | null;
  instructions: string[];
};

/** id → library-exercise resolver from pre-fetched rows (+ GymSnap-authored
 *  custom fallback). Lets hydration avoid per-id DB round trips. */
function makeExerciseResolver(
  rows: (typeof exercises.$inferSelect)[]
): (id: string | null | undefined) => LibExercise | null {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return (id) => {
    if (!id) return null;
    const row = byId.get(id);
    if (row) {
      return {
        id: row.id,
        name: row.name,
        images: row.images,
        equipment: row.equipment,
        instructions: row.instructions,
      };
    }
    const custom = CUSTOM_BY_ID[id];
    if (custom) {
      return {
        id: custom.id,
        name: custom.name,
        images: custom.images,
        equipment: custom.equipment,
        instructions: custom.instructions,
      };
    }
    return null;
  };
}

function resolveRoutineItems(
  items: StoredRoutineItem[],
  resolve: (id: string | null | undefined) => LibExercise | null
): HydratedRoutineItem[] {
  return items.map((item) => {
    const ex = resolve(item.exerciseId);
    return {
      exerciseId: item.exerciseId,
      nameOverride: item.nameOverride,
      howTo: item.howTo ?? "",
      duration: item.duration ?? "",
      exercise: ex
        ? {
            id: ex.id,
            name: ex.name,
            images: ex.images,
            equipment: ex.equipment,
            instructions: ex.instructions,
          }
        : null,
    };
  });
}

async function hydrateWeek(weekRow: typeof weeks.$inferSelect): Promise<FullWeek> {
  // Batched fetch — a handful of queries for the whole week instead of one per
  // day and per exercise (the old N+1, which got slow and risked timeouts).
  const [dayRows, checkinRows] = await Promise.all([
    db.select().from(days).where(eq(days.weekId, weekRow.id)).orderBy(days.orderIndex),
    db.select().from(checkins).where(eq(checkins.weekId, weekRow.id)),
  ]);
  const checkin = checkinRows[0];
  const dayIds = dayRows.map((d) => d.id);

  const [entryRows, dayCheckinRows] = await Promise.all([
    dayIds.length
      ? db
          .select()
          .from(exerciseEntries)
          .where(inArray(exerciseEntries.dayId, dayIds))
          .orderBy(exerciseEntries.orderIndex)
      : Promise.resolve([] as (typeof exerciseEntries.$inferSelect)[]),
    checkin
      ? db.select().from(dayCheckins).where(eq(dayCheckins.checkinId, checkin.id))
      : Promise.resolve([] as (typeof dayCheckins.$inferSelect)[]),
  ]);

  const entryIds = entryRows.map((e) => e.id);
  const logRows = entryIds.length
    ? await db
        .select()
        .from(exerciseSetLogs)
        .where(inArray(exerciseSetLogs.entryId, entryIds))
        .orderBy(exerciseSetLogs.setNumber)
    : [];

  // Every library id referenced anywhere in the week (main exercises,
  // alternatives, warmup items, stretch items) → ONE query.
  const referencedIds = new Set<string>();
  for (const e of entryRows) {
    if (e.exerciseId) referencedIds.add(e.exerciseId);
    for (const a of e.alternatives ?? []) if (a.exerciseId) referencedIds.add(a.exerciseId);
  }
  for (const d of dayRows) {
    for (const w of d.warmupItems ?? []) if (w.exerciseId) referencedIds.add(w.exerciseId);
  }
  for (const b of weekRow.stretchBlocks ?? []) {
    for (const it of b.items ?? []) if (it.exerciseId) referencedIds.add(it.exerciseId);
  }
  const exerciseRows = referencedIds.size
    ? await db.select().from(exercises).where(inArray(exercises.id, [...referencedIds]))
    : [];
  const resolve = makeExerciseResolver(exerciseRows);

  // Group logs + entries in memory.
  const logsByEntry = new Map<number, typeof logRows>();
  for (const l of logRows) {
    const arr = logsByEntry.get(l.entryId) ?? [];
    arr.push(l);
    logsByEntry.set(l.entryId, arr);
  }
  const entriesByDay = new Map<number, typeof entryRows>();
  for (const e of entryRows) {
    const arr = entriesByDay.get(e.dayId) ?? [];
    arr.push(e);
    entriesByDay.set(e.dayId, arr);
  }

  const fullDays: FullDay[] = dayRows.map((day) => {
    const fullEntries: FullExerciseEntry[] = (entriesByDay.get(day.id) ?? []).map((entry) => {
      const ex = resolve(entry.exerciseId);
      const alternatives: HydratedAlternative[] = (entry.alternatives ?? []).map((alt) => {
        const a = resolve(alt.exerciseId);
        return {
          exerciseId: alt.exerciseId,
          nameOverride: alt.nameOverride,
          note: alt.note ?? "",
          exercise: a
            ? { id: a.id, name: a.name, images: a.images, equipment: a.equipment }
            : null,
        };
      });
      return {
        id: entry.id,
        orderIndex: entry.orderIndex,
        exerciseId: entry.exerciseId,
        nameOverride: entry.nameOverride,
        sets: entry.sets,
        reps: entry.reps,
        weight: entry.weight,
        restSec: entry.restSec,
        notes: entry.notes,
        unverified: entry.unverified,
        exercise: ex
          ? {
              id: ex.id,
              name: ex.name,
              images: ex.images,
              instructions: ex.instructions,
              equipment: ex.equipment,
            }
          : null,
        alternatives,
        logs: (logsByEntry.get(entry.id) ?? []).map((l) => ({
          id: l.id,
          setNumber: l.setNumber,
          weight: l.weight,
          weightUnit: l.weightUnit,
          reps: l.reps,
          toFailure: l.toFailure,
          loggedAt: l.loggedAt,
        })),
      };
    });

    const dayCheckin = dayCheckinRows.find((dc) => dc.dayId === day.id);
    return {
      id: day.id,
      orderIndex: day.orderIndex,
      dayLabel: day.dayLabel,
      focus: day.focus,
      warmup: day.warmup,
      cooldown: day.cooldown,
      cardio: day.cardioType
        ? {
            type: day.cardioType,
            durationMin: day.cardioDurationMin ?? 0,
            incline: day.cardioIncline,
            targetHr: day.cardioTargetHr,
          }
        : null,
      cardioActualMin: day.cardioActualMin,
      warmupItems: resolveRoutineItems(day.warmupItems ?? [], resolve),
      exercises: fullEntries,
      checkinStatus: dayCheckin ? dayCheckin.status : null,
    };
  });

  const stretchBlocks: HydratedStretchBlock[] = (weekRow.stretchBlocks ?? []).map((b) => ({
    title: b.title,
    targetMuscles: b.targetMuscles ?? [],
    items: resolveRoutineItems(b.items ?? [], resolve),
  }));

  return {
    id: weekRow.id,
    weekNumber: weekRow.weekNumber,
    createdAt: weekRow.createdAt,
    days: fullDays,
    stretchBlocks,
    checkin: checkin
      ? {
          id: checkin.id,
          overallComment: checkin.overallComment,
          wellbeing: checkin.wellbeing,
          kneesRating: checkin.kneesRating,
          lowerBackRating: checkin.lowerBackRating,
        }
      : null,
  };
}

export async function getLatestWeek(userId: string): Promise<FullWeek | null> {
  const rows = await db
    .select()
    .from(weeks)
    .where(eq(weeks.userId, userId))
    .orderBy(desc(weeks.weekNumber))
    .limit(1);
  const weekRow = rows[0];
  if (!weekRow) return null;
  return hydrateWeek(weekRow);
}

export async function getWeekByNumber(
  userId: string,
  weekNumber: number
): Promise<FullWeek | null> {
  const rows = await db
    .select()
    .from(weeks)
    .where(and(eq(weeks.userId, userId), eq(weeks.weekNumber, weekNumber)));
  const weekRow = rows[0];
  if (!weekRow) return null;
  return hydrateWeek(weekRow);
}

export async function getAllWeeksSummary(userId: string) {
  const rows = await db
    .select()
    .from(weeks)
    .where(eq(weeks.userId, userId))
    .orderBy(desc(weeks.weekNumber));
  const result = [];
  for (const w of rows) {
    const checkinRows = await db.select().from(checkins).where(eq(checkins.weekId, w.id));
    result.push({
      id: w.id,
      weekNumber: w.weekNumber,
      createdAt: w.createdAt,
      hasCheckin: checkinRows.length > 0,
    });
  }
  return result;
}

/** True if the given week row is owned by this user — used to gate check-ins. */
export async function weekBelongsToUser(userId: string, weekId: number): Promise<boolean> {
  const rows = await db
    .select({ id: weeks.id })
    .from(weeks)
    .where(and(eq(weeks.id, weekId), eq(weeks.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** True if the given exercise entry belongs to this user (via day → week). */
export async function entryBelongsToUser(
  userId: string,
  entryId: number
): Promise<boolean> {
  const rows = await db
    .select({ id: exerciseEntries.id })
    .from(exerciseEntries)
    .innerJoin(days, eq(exerciseEntries.dayId, days.id))
    .innerJoin(weeks, eq(days.weekId, weeks.id))
    .where(and(eq(exerciseEntries.id, entryId), eq(weeks.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function dayBelongsToUser(
  userId: string,
  dayId: number
): Promise<boolean> {
  const rows = await db
    .select({ id: days.id })
    .from(days)
    .innerJoin(weeks, eq(days.weekId, weeks.id))
    .where(and(eq(days.id, dayId), eq(weeks.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export type DiaryEntry = {
  // Exact save instant (ISO). The client groups these by its LOCAL date so the
  // diary day matches the user's device timezone rather than the server's UTC.
  loggedAt: string;
  entryId: number;
  name: string;
  weekNumber: number;
  dayLabel: string;
  sets: SetLog[];
};

/**
 * Flat diary entries — one per (exercise, save instant) — newest first.
 * Grouping into days is done on the client, in the viewer's local timezone.
 */
export async function getDiaryEntries(userId: string): Promise<DiaryEntry[]> {
  const rows = await db
    .select({
      log: exerciseSetLogs,
      entryId: exerciseEntries.id,
      nameOverride: exerciseEntries.nameOverride,
      exerciseName: exercises.name,
      dayLabel: days.dayLabel,
      weekNumber: weeks.weekNumber,
    })
    .from(exerciseSetLogs)
    .innerJoin(exerciseEntries, eq(exerciseSetLogs.entryId, exerciseEntries.id))
    .innerJoin(days, eq(exerciseEntries.dayId, days.id))
    .innerJoin(weeks, eq(days.weekId, weeks.id))
    .leftJoin(exercises, eq(exerciseEntries.exerciseId, exercises.id))
    .where(eq(exerciseSetLogs.userId, userId))
    .orderBy(desc(exerciseSetLogs.loggedAt));

  // Group by exact instant + entry (a save writes all sets with one loggedAt).
  const map = new Map<string, DiaryEntry>();
  for (const r of rows) {
    const key = `${r.log.loggedAt}__${r.entryId}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        loggedAt: r.log.loggedAt,
        entryId: r.entryId,
        name: r.nameOverride ?? r.exerciseName ?? "Exercise",
        weekNumber: r.weekNumber,
        dayLabel: r.dayLabel,
        sets: [],
      };
      map.set(key, entry);
    }
    entry.sets.push({
      id: r.log.id,
      setNumber: r.log.setNumber,
      weight: r.log.weight,
      weightUnit: r.log.weightUnit,
      reps: r.log.reps,
      toFailure: r.log.toFailure,
      loggedAt: r.log.loggedAt,
    });
  }

  return [...map.values()].map((e) => ({
    ...e,
    sets: e.sets.sort((a, b) => a.setNumber - b.setNumber),
  }));
}

export async function getAllWeeksHistoryForPrompt(userId: string): Promise<FullWeek[]> {
  const rows = await db
    .select()
    .from(weeks)
    .where(eq(weeks.userId, userId))
    .orderBy(weeks.weekNumber);
  const result: FullWeek[] = [];
  for (const row of rows) {
    result.push(await hydrateWeek(row));
  }
  return result;
}
