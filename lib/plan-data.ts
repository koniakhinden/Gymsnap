import { db } from "./db";
import {
  weeks,
  days,
  exerciseEntries,
  exercises,
  checkins,
  dayCheckins,
  profiles,
  gyms,
  equipmentItems,
} from "./db/schema";
import { desc, eq } from "drizzle-orm";

export async function getLatestProfile() {
  const rows = await db.select().from(profiles).orderBy(desc(profiles.id)).limit(1);
  return rows[0];
}

export async function getLatestGymWithEquipment() {
  const gymRows = await db.select().from(gyms).orderBy(desc(gyms.id)).limit(1);
  const gym = gymRows[0];
  if (!gym) return null;
  const items = await db
    .select()
    .from(equipmentItems)
    .where(eq(equipmentItems.gymId, gym.id));
  return { gym, items };
}

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
  } | null;
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
        exercise: exerciseRow
          ? {
              id: exerciseRow.id,
              name: exerciseRow.name,
              images: exerciseRow.images,
              instructions: exerciseRow.instructions,
            }
          : null,
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

export async function getLatestWeek(): Promise<FullWeek | null> {
  const rows = await db.select().from(weeks).orderBy(desc(weeks.weekNumber)).limit(1);
  const weekRow = rows[0];
  if (!weekRow) return null;
  return hydrateWeek(weekRow);
}

export async function getWeekByNumber(weekNumber: number): Promise<FullWeek | null> {
  const rows = await db.select().from(weeks).where(eq(weeks.weekNumber, weekNumber));
  const weekRow = rows[0];
  if (!weekRow) return null;
  return hydrateWeek(weekRow);
}

export async function getAllWeeksSummary() {
  const rows = await db.select().from(weeks).orderBy(desc(weeks.weekNumber));
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

export async function getAllWeeksHistoryForPrompt(): Promise<FullWeek[]> {
  const rows = await db.select().from(weeks).orderBy(weeks.weekNumber);
  const result: FullWeek[] = [];
  for (const row of rows) {
    result.push(await hydrateWeek(row));
  }
  return result;
}
