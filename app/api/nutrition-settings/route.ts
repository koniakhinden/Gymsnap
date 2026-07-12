import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nutritionSettings } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { getNutritionSettings } from "@/lib/nutrition-data";
import { nutritionSettingsSchema } from "@/lib/validation/nutrition";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getUserId();
    return NextResponse.json({ settings: await getNutritionSettings(userId) });
  } catch (err) {
    return jsonError(err, "Failed to load food settings.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const s = nutritionSettingsSchema.parse(await req.json());
    const now = new Date().toISOString();
    const values = {
      userId,
      country: s.country,
      region: s.region,
      city: s.city,
      cuisines: s.cuisines,
      likes: s.likes,
      dislikes: s.dislikes,
      budgetLevel: s.budgetLevel ?? null,
      calorieTargetOverride: s.calorieTargetOverride ?? null,
      updatedAt: now,
    };
    await db
      .insert(nutritionSettings)
      .values(values)
      .onConflictDoUpdate({ target: nutritionSettings.userId, set: values });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, "Failed to save food settings.", 400);
  }
}
