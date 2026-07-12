import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eaters } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { getEaters } from "@/lib/nutrition-data";
import { saveEatersSchema } from "@/lib/validation/nutrition";
import { jsonError } from "@/lib/api-error";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getUserId();
    return NextResponse.json({ eaters: await getEaters(userId) });
  } catch (err) {
    return jsonError(err, "Failed to load household.");
  }
}

// Replace the whole household in one call (the client always sends the full list).
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { eaters: list } = saveEatersSchema.parse(await req.json());
    const now = new Date().toISOString();

    await db.delete(eaters).where(eq(eaters.userId, userId));
    await db.insert(eaters).values(
      list.map((e, i) => ({
        userId,
        orderIndex: i,
        name: e.name,
        isSelf: e.isSelf,
        sex: e.sex,
        ageYears: e.ageYears,
        heightCm: e.heightCm,
        weightKg: e.weightKg,
        activity: e.activity,
        goal: e.goal,
        dietary: e.dietary,
        allergies: e.allergies,
        updatedAt: now,
      }))
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, "Failed to save household.", 400);
  }
}
