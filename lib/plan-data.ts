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
  return db.select().from(profiles).orderBy(desc(profiles.id)).limit(1).get();
}

export async function getLatestGymWithEquipment() {
  const gym = db.select().from(gyms).orderBy(desc(gyms.id)).limit(1).get();
  if (!gym) return null;
  const items = db
    .select()
    .from(equipmentItems)
    .where(eq(equipmentItems.gymId, gym.id))
    .all();
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
  const dayRows = db
    .select()
    .from(days)
    .where(eq(days.weekId, weekRow.id))
    .orderBy(days.orderIndex)
    .all();

  const checkin = db
    .select()
    .from(checkins)
    .where(eq(checkins.weekId, weekRow.id))
    .get();

  const dayCheckinRows = checkin
    ? db.select().from(dayCheckins).where(eq(dayCheckins.checkinId, checkin.id)).all()
    : [];

  const fullDays: FullDay[] = dayRows.map((day) => {
    const entryRows = db
      .select()
      .from(exerciseEntries)
      .where(eq(exerciseEntries.dayId, day.id))
      .orderBy(exerciseEntries.orderIndex)
      .all();

    const fullEntries: FullExerciseEntry[] = entryRows.map((entry) => {
      const exerciseRow = entry.exerciseId
        ? db.select().from(exercises).where(eq(exercises.id, entry.exerciseId)).get()
        : undefined;
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
        exercise: exerciseRow
          ? {
              id: exerciseRow.id,
              name: exerciseRow.name,
              images: JSON.parse(exerciseRow.images || "[]"),
              instructions: JSON.parse(exerciseRow.instructions || "[]"),
            }
          : null,
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
      exercises: fullEntries,
      checkinStatus: dayCheckin ? dayCheckin.status : null,
    };
  });

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
  const weekRow = db.select().from(weeks).orderBy(desc(weeks.weekNumber)).limit(1).get();
  if (!weekRow) return null;
  return hydrateWeek(weekRow);
}

export async function getWeekByNumber(weekNumber: number): Promise<FullWeek | null> {
  const weekRow = db
    .select()
    .from(weeks)
    .where(eq(weeks.weekNumber, weekNumber))
    .get();
  if (!weekRow) return null;
  return hydrateWeek(weekRow);
}

export async function getAllWeeksSummary() {
  const rows = db.select().from(weeks).orderBy(desc(weeks.weekNumber)).all();
  return rows.map((w) => {
    const checkin = db.select().from(checkins).where(eq(checkins.weekId, w.id)).get();
    return {
      id: w.id,
      weekNumber: w.weekNumber,
      createdAt: w.createdAt,
      hasCheckin: !!checkin,
    };
  });
}

export async function getAllWeeksHistoryForPrompt(): Promise<FullWeek[]> {
  const rows = db.select().from(weeks).orderBy(weeks.weekNumber).all();
  const result: FullWeek[] = [];
  for (const row of rows) {
    result.push(await hydrateWeek(row));
  }
  return result;
}
