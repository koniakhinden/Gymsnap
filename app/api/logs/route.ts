import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exerciseSetLogs } from "@/lib/db/schema";
import { logSaveSchema } from "@/lib/validation/set-log";
import { getUserId } from "@/lib/user";
import { entryBelongsToUser } from "@/lib/plan-data";
import { and, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const parsed = logSaveSchema.parse(body);

    // Can't log against an exercise entry you don't own.
    if (!(await entryBelongsToUser(userId, parsed.entryId))) {
      return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
    }

    // Replace this entry's logs wholesale (the client always sends the full set list).
    await db
      .delete(exerciseSetLogs)
      .where(
        and(
          eq(exerciseSetLogs.entryId, parsed.entryId),
          eq(exerciseSetLogs.userId, userId)
        )
      );

    const now = new Date().toISOString();
    if (parsed.sets.length > 0) {
      await db.insert(exerciseSetLogs).values(
        parsed.sets.map((s) => ({
          entryId: parsed.entryId,
          userId,
          setNumber: s.setNumber,
          weight: s.weight,
          weightUnit: parsed.weightUnit,
          reps: s.reps,
          toFailure: s.toFailure,
          loggedAt: now,
        }))
      );
    }

    return NextResponse.json({ ok: true, loggedAt: now });
  } catch (err) {
    console.error("save log error:", err);
    const message = err instanceof Error ? err.message : "Failed to save log.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
