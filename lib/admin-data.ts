import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { weeks, quickWorkouts, profiles, checkins } from "./db/schema";
import { getAllWeeksHistoryForPrompt, type FullWeek } from "./plan-data";
import { hydrateQuickWorkout, type HydratedQuickWorkout } from "./quick-workout-data";
import type { QuickWorkout } from "./validation/quick-workout";

// Owner-facing usage analytics. Everything is derived from existing tables
// (weeks, quick_workouts, check-ins, profiles) — no separate events store — so
// at beta scale we can just pull the rows and aggregate in JS.

export type AdminUserRow = {
  userId: string;
  weeks: number;
  quickWorkouts: number;
  checkins: number;
  goal: string | null;
  experience: string | null;
  lastActivity: string | null;
};

export type AdminAnalytics = {
  generatedAt: string;
  totals: {
    users: number;
    weeks: number;
    quickWorkouts: number;
    checkins: number;
    weeksLast7: number;
    quickLast7: number;
    activeUsersLast7: number;
  };
  daily: { date: string; weeks: number; quick: number }[];
  users: AdminUserRow[];
};

export type AdminUserPrograms = {
  userId: string;
  weeks: FullWeek[];
  quickWorkouts: {
    id: number;
    createdAt: string;
    timeMin: number;
    workout: HydratedQuickWorkout;
  }[];
};

/** Full generated programs for one user — every weekly plan and quick workout. */
export async function getUserPrograms(userId: string): Promise<AdminUserPrograms> {
  const userWeeks = await getAllWeeksHistoryForPrompt(userId);
  const qRows = await db
    .select()
    .from(quickWorkouts)
    .where(eq(quickWorkouts.userId, userId))
    .orderBy(desc(quickWorkouts.id));
  const quick = await Promise.all(
    qRows.map(async (r) => ({
      id: r.id,
      createdAt: r.createdAt,
      timeMin: r.timeMin,
      workout: await hydrateQuickWorkout(r.result as QuickWorkout),
    }))
  );
  return { userId, weeks: userWeeks, quickWorkouts: quick };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC YYYY-MM-DD for an ISO timestamp. */
function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const [weekRows, quickRows, profileRows, checkinRows] = await Promise.all([
    db
      .select({ id: weeks.id, userId: weeks.userId, createdAt: weeks.createdAt })
      .from(weeks),
    db
      .select({ userId: quickWorkouts.userId, createdAt: quickWorkouts.createdAt })
      .from(quickWorkouts),
    db
      .select({
        userId: profiles.userId,
        goal: profiles.goal,
        experience: profiles.experience,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles),
    db
      .select({ weekId: checkins.weekId, createdAt: checkins.createdAt })
      .from(checkins),
  ]);

  const now = Date.now();
  const sevenAgo = now - 7 * DAY_MS;

  // Map a week id to its owner so check-ins (keyed by week) can be attributed.
  const weekOwner = new Map<number, string>();
  for (const w of weekRows) weekOwner.set(w.id, w.userId);

  // Latest profile per user (goal/experience for the table).
  const latestProfile = new Map<string, { goal: string; experience: string; updatedAt: string }>();
  for (const p of profileRows) {
    const prev = latestProfile.get(p.userId);
    if (!prev || new Date(p.updatedAt) > new Date(prev.updatedAt)) {
      latestProfile.set(p.userId, { goal: p.goal, experience: p.experience, updatedAt: p.updatedAt });
    }
  }

  // Per-user accumulator.
  const users = new Map<string, AdminUserRow>();
  const ensure = (userId: string): AdminUserRow => {
    let row = users.get(userId);
    if (!row) {
      const prof = latestProfile.get(userId);
      row = {
        userId,
        weeks: 0,
        quickWorkouts: 0,
        checkins: 0,
        goal: prof?.goal ?? null,
        experience: prof?.experience ?? null,
        lastActivity: null,
      };
      users.set(userId, row);
    }
    return row;
  };
  const touch = (row: AdminUserRow, iso: string) => {
    if (!row.lastActivity || new Date(iso) > new Date(row.lastActivity)) {
      row.lastActivity = iso;
    }
  };

  for (const w of weekRows) {
    const row = ensure(w.userId);
    row.weeks += 1;
    touch(row, w.createdAt);
  }
  for (const q of quickRows) {
    const row = ensure(q.userId);
    row.quickWorkouts += 1;
    touch(row, q.createdAt);
  }
  for (const c of checkinRows) {
    const owner = weekOwner.get(c.weekId);
    if (!owner) continue;
    const row = ensure(owner);
    row.checkins += 1;
    touch(row, c.createdAt);
  }
  // Users that only have a profile (no created programs yet) still count.
  for (const p of profileRows) ensure(p.userId);

  const weeksLast7 = weekRows.filter((w) => new Date(w.createdAt).getTime() >= sevenAgo).length;
  const quickLast7 = quickRows.filter((q) => new Date(q.createdAt).getTime() >= sevenAgo).length;
  const activeUsersLast7 = new Set([
    ...weekRows.filter((w) => new Date(w.createdAt).getTime() >= sevenAgo).map((w) => w.userId),
    ...quickRows.filter((q) => new Date(q.createdAt).getTime() >= sevenAgo).map((q) => q.userId),
  ]).size;

  // 30-day daily series (oldest → newest).
  const daily: { date: string; weeks: number; quick: number }[] = [];
  const byDayWeeks = new Map<string, number>();
  const byDayQuick = new Map<string, number>();
  for (const w of weekRows) byDayWeeks.set(dayKey(w.createdAt), (byDayWeeks.get(dayKey(w.createdAt)) ?? 0) + 1);
  for (const q of quickRows) byDayQuick.set(dayKey(q.createdAt), (byDayQuick.get(dayKey(q.createdAt)) ?? 0) + 1);
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    daily.push({ date, weeks: byDayWeeks.get(date) ?? 0, quick: byDayQuick.get(date) ?? 0 });
  }

  const userList = [...users.values()].sort((a, b) => {
    const at = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const bt = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return bt - at;
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      users: users.size,
      weeks: weekRows.length,
      quickWorkouts: quickRows.length,
      checkins: checkinRows.length,
      weeksLast7,
      quickLast7,
      activeUsersLast7,
    },
    daily,
    users: userList,
  };
}
