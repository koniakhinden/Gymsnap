import { db } from "./db";
import { eaters, nutritionSettings } from "./db/schema";
import { asc, eq } from "drizzle-orm";

export async function getEaters(userId: string) {
  return db
    .select()
    .from(eaters)
    .where(eq(eaters.userId, userId))
    .orderBy(asc(eaters.orderIndex));
}

export async function getNutritionSettings(userId: string) {
  const rows = await db
    .select()
    .from(nutritionSettings)
    .where(eq(nutritionSettings.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}
