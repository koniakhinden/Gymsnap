import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { exerciseEntries } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { dayBelongsToUser } from "@/lib/plan-data";
import { exerciseSelectionSchema, validateSelection } from "@/lib/entry-selection";

export const runtime = "nodejs";

// Add a user-chosen exercise to a day. The exercise identity comes from the
// picker (a library id or a free-text name); the prescription defaults to a
// sensible 3 x 8-12 that the user can then log against and edit.
const addSchema = exerciseSelectionSchema.extend({
  sets: z.number().int().min(1).max(10).default(3),
  reps: z.string().trim().min(1).max(20).default("8-12"),
  weight: z.string().trim().max(30).default(""),
  restSec: z.number().int().min(0).max(600).default(90),
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
    if (!(await dayBelongsToUser(userId, id))) {
      return NextResponse.json({ error: "Day not found." }, { status: 404 });
    }

    const body = addSchema.parse(await req.json());
    const check = await validateSelection(userId, body);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    // Append after the current last exercise.
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${exerciseEntries.orderIndex}), -1)` })
      .from(exerciseEntries)
      .where(eq(exerciseEntries.dayId, id));

    const [row] = await db
      .insert(exerciseEntries)
      .values({
        dayId: id,
        orderIndex: (max ?? -1) + 1,
        exerciseId: body.exerciseId,
        nameOverride: body.exerciseId ? null : (body.nameOverride?.trim() || null),
        sets: body.sets,
        reps: body.reps,
        weight: body.weight,
        restSec: body.restSec,
        notes: "",
        alternatives: [],
        activeAltIndex: null,
      })
      .returning({ id: exerciseEntries.id });

    return NextResponse.json({ ok: true, entryId: row.id });
  } catch (err) {
    console.error("add exercise error:", err);
    const message = err instanceof Error ? err.message : "Failed to add exercise.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
