import { db } from "./db";
import { menuWeeks } from "./db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { MenuResult, MenuTargets } from "./validation/menu";

export type FullMenu = {
  id: number;
  weekNumber: number;
  createdAt: string;
  targets: MenuTargets;
  result: MenuResult;
};

function toFull(row: typeof menuWeeks.$inferSelect): FullMenu {
  return {
    id: row.id,
    weekNumber: row.weekNumber,
    createdAt: row.createdAt,
    targets: row.targets as MenuTargets,
    result: row.result as MenuResult,
  };
}

export async function getLatestMenu(userId: string): Promise<FullMenu | null> {
  const rows = await db
    .select()
    .from(menuWeeks)
    .where(eq(menuWeeks.userId, userId))
    .orderBy(desc(menuWeeks.weekNumber))
    .limit(1);
  return rows[0] ? toFull(rows[0]) : null;
}

export async function getMenuByNumber(userId: string, weekNumber: number): Promise<FullMenu | null> {
  const rows = await db
    .select()
    .from(menuWeeks)
    .where(and(eq(menuWeeks.userId, userId), eq(menuWeeks.weekNumber, weekNumber)))
    .limit(1);
  return rows[0] ? toFull(rows[0]) : null;
}

export async function getMenuSummary(
  userId: string
): Promise<{ weekNumber: number; createdAt: string; title: string }[]> {
  const rows = await db
    .select()
    .from(menuWeeks)
    .where(eq(menuWeeks.userId, userId))
    .orderBy(desc(menuWeeks.weekNumber));
  return rows.map((r) => ({
    weekNumber: r.weekNumber,
    createdAt: r.createdAt,
    title: (r.result as MenuResult)?.title ?? `Week ${r.weekNumber}`,
  }));
}

export async function nextMenuWeekNumber(userId: string): Promise<number> {
  const rows = await db
    .select({ weekNumber: menuWeeks.weekNumber })
    .from(menuWeeks)
    .where(eq(menuWeeks.userId, userId))
    .orderBy(desc(menuWeeks.weekNumber))
    .limit(1);
  return rows[0] ? rows[0].weekNumber + 1 : 1;
}
