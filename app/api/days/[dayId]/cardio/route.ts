import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { days } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { dayBelongsToUser } from "@/lib/plan-data";
import { eq } from "drizzle-orm";

// Save (or clear) the cardio minutes the user actually did for a day.
// actualMin: a whole number of minutes, or null to clear the log.
const cardioLogSchema = z.object({
  actualMin: z.number().int().min(0).max(300).nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dayId: string }> }
) {
  try {
    const userId = await getUserId();
    const { dayId } = await params;
    const id = Number(dayId);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Invalid day id." }, { status: 400 });
    }

    // Can't log cardio against a day you don't own.
    if (!(await dayBelongsToUser(userId, id))) {
      return NextResponse.json({ error: "Day not found." }, { status: 404 });
    }

    const { actualMin } = cardioLogSchema.parse(await req.json());

    await db
      .update(days)
      .set({ cardioActualMin: actualMin })
      .where(eq(days.id, id));

    return NextResponse.json({ ok: true, cardioActualMin: actualMin });
  } catch (err) {
    console.error("save cardio log error:", err);
    const message = err instanceof Error ? err.message : "Failed to save cardio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
