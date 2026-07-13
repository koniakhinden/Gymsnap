import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mealLogs } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { mealLogSchema } from "@/lib/validation/meal-log";
import { jsonError } from "@/lib/api-error";
import { and, asc, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const day = req.nextUrl.searchParams.get("day");
    if (!day) return NextResponse.json({ error: "Missing day." }, { status: 400 });

    const logs = await db
      .select()
      .from(mealLogs)
      .where(and(eq(mealLogs.userId, userId), eq(mealLogs.day, day)))
      .orderBy(asc(mealLogs.id));

    const totals = logs.reduce(
      (t, l) => ({
        calories: t.calories + l.calories,
        proteinG: t.proteinG + l.proteinG,
        fatG: t.fatG + l.fatG,
        carbG: t.carbG + l.carbG,
      }),
      { calories: 0, proteinG: 0, fatG: 0, carbG: 0 }
    );
    return NextResponse.json({ logs, totals });
  } catch (err) {
    return jsonError(err, "Failed to load your food log.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const input = mealLogSchema.parse(await req.json());
    const [row] = await db
      .insert(mealLogs)
      .values({ userId, ...input, createdAt: new Date().toISOString() })
      .returning();
    return NextResponse.json({ id: row.id });
  } catch (err) {
    return jsonError(err, "Failed to log the meal.", 400);
  }
}
