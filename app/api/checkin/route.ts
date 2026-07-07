import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkins, dayCheckins } from "@/lib/db/schema";
import { checkinInputSchema } from "@/lib/validation/checkin";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = checkinInputSchema.parse(body);

    const existing = db
      .select()
      .from(checkins)
      .where(eq(checkins.weekId, parsed.weekId))
      .get();
    if (existing) {
      db.delete(dayCheckins).where(eq(dayCheckins.checkinId, existing.id)).run();
      db.delete(checkins).where(eq(checkins.id, existing.id)).run();
    }

    const now = new Date().toISOString();
    const checkin = db
      .insert(checkins)
      .values({
        weekId: parsed.weekId,
        overallComment: parsed.overallComment,
        wellbeing: parsed.wellbeing,
        kneesRating: parsed.kneesRating,
        lowerBackRating: parsed.lowerBackRating,
        createdAt: now,
      })
      .returning()
      .get();

    for (const d of parsed.days) {
      db.insert(dayCheckins)
        .values({ checkinId: checkin.id, dayId: d.dayId, status: d.status })
        .run();
    }

    return NextResponse.json({ checkinId: checkin.id });
  } catch (err) {
    console.error("save checkin error:", err);
    const message = err instanceof Error ? err.message : "Failed to save check-in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
