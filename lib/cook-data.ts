import { db } from "./db";
import { quickMeals } from "./db/schema";
import { desc, eq, and } from "drizzle-orm";
import type { CookResult } from "./validation/cook";

export type CookHistoryItem = {
  id: number;
  createdAt: string;
  source: "photo" | "manual";
  mealType: string;
  servings: number;
  title: string;
};

export async function getRecentMeals(userId: string, limit = 5): Promise<CookHistoryItem[]> {
  const rows = await db
    .select()
    .from(quickMeals)
    .where(eq(quickMeals.userId, userId))
    .orderBy(desc(quickMeals.id))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    source: r.source,
    mealType: r.mealType,
    servings: r.servings,
    title: (r.result as CookResult)?.title ?? "Meal",
  }));
}

export async function getMealById(userId: string, id: number): Promise<CookResult | null> {
  const rows = await db
    .select()
    .from(quickMeals)
    .where(and(eq(quickMeals.id, id), eq(quickMeals.userId, userId)))
    .limit(1);
  return rows[0] ? (rows[0].result as CookResult) : null;
}
