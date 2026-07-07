import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkins, dayCheckins } from "@/lib/db/schema";
import { checkinInputSchema } from "@/lib/validation/checkin";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = checkinInputSchema.parse(body);

    const existingRows = await db
      .select()
      .from(checkins)
      .where(eq(checkins.weekId, parsed.weekId));
    const existing = existingRows[0];
    if (existing) {
      await db.delete(dayCheckins).where(eq(dayCheckins.checkinId, existing.id));
      await db.delete(checkins).where(eq(checkins.id, existing.id));
    }

    const now = new Date().toISOString();
    const [checkin] = await db
      .insert(checkins)
      .values({
        weekId: parsed.weekId,
        overallComment: parsed.overallComment,
        wellbeing: parsed.wellbeing,
        kneesRating: parsed.kneesRating,
        lowerBackRating: parsed.lowerBackRating,
        createdAt: now,
      })
      .returning();

    for (const d of parsed.days) {
      await db
        .insert(dayCheckins)
        .values({ checkinId: checkin.id, dayId: d.dayId, status: d.status });
    }

    return NextResponse.json({ checkinId: checkin.id });
  } catch (err) {
    console.error("save checkin error:", err);
    const message = err instanceof Error ? err.message : "Failed to save check-in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
