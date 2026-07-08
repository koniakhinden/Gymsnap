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
  exercises: FullExerciseEntry[];
  checkinStatus: "completed" | "partial" | "skipped" | null;
};

export type FullWeek = {
  id: number;
  weekNumber: number;
  createdAt: string;
  days: FullDay[];
  checkin: {
    id: number;
    overallComment: string | null;
    wellbeing: number;
    kneesRating: number;
    lowerBackRating: number;
  } | null;
};

async function hydrateWeek(weekRow: typeof weeks.$inferSelect): Promise<FullWeek> {
  const dayRows = await db
    .select()
    .from(days)
    .where(eq(days.weekId, weekRow.id))
    .orderBy(days.orderIndex);

  const checkinRows = await db
    .select()
    .from(checkins)
    .where(eq(checkins.weekId, weekRow.id));
  const checkin = checkinRows[0];

  const dayCheckinRows = checkin
    ? await db.select().from(dayCheckins).where(eq(dayCheckins.checkinId, checkin.id))
    : [];

  const fullDays: FullDay[] = [];
  for (const day of dayRows) {
    const entryRows = await db
      .select()
      .from(exerciseEntries)
      .where(eq(exerciseEntries.dayId, day.id))
      .orderBy(exerciseEntries.orderIndex);

    const entryIds = entryRows.map((e) => e.id);
    const logRows =
      entryIds.length > 0
        ? await db
            .select()
            .from(exerciseSetLogs)
            .where(inArray(exerciseSetLogs.entryId, entryIds))
            .orderBy(exerciseSetLogs.setNumber)
        : [];

    const fullEntries: FullExerciseEntry[] = [];
    for (const entry of entryRows) {
      let exerciseRow: typeof exercises.$inferSelect | undefined;
      if (entry.exerciseId) {
        const rows = await db
          .select()
          .from(exercises)
          .where(eq(exercises.id, entry.exerciseId));
        exerciseRow = rows[0];
      }
      // Fall back to the GymSnap-authored library for custom ladder rungs that
      // may not be in the DB yet (e.g. before a re-seed).
      const custom = entry.exerciseId ? CUSTOM_BY_ID[entry.exerciseId] : undefined;
      const resolvedExercise = exerciseRow
        ? {
            id: exerciseRow.id,
            name: exerciseRow.name,
            images: exerciseRow.images,
            instructions: exerciseRow.instructions,
            equipment: exerciseRow.equipment,
          }
        : custom
          ? {
              id: custom.id,
              name: custom.name,
              images: custom.images,
              instructions: custom.instructions,
              equipment: custom.equipment,
            }
          : null;
      fullEntries.push({
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
        exercise: resolvedExercise,
        logs: logRows
          .filter((l) => l.entryId === entry.id)
          .map((l) => ({
            id: l.id,
            setNumber: l.setNumber,
            weight: l.weight,
            weightUnit: l.weightUnit,
            reps: l.reps,
            toFailure: l.toFailure,
            loggedAt: l.loggedAt,
          })),
      });
    }

    const dayCheckin = dayCheckinRows.find((dc) => dc.dayId === day.id);

    fullDays.push({
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
      exercises: fullEntries,
      checkinStatus: dayCheckin ? dayCheckin.status : null,
    });
  }

  return {
    id: weekRow.id,
    weekNumber: weekRow.weekNumber,
    createdAt: weekRow.createdAt,
    days: fullDays,
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
