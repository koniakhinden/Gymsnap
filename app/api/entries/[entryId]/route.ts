import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exerciseEntries } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { entryBelongsToUser } from "@/lib/plan-data";
import { exerciseSelectionSchema, validateSelection } from "@/lib/entry-selection";

export const runtime = "nodejs";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

// Change the exercise on an existing entry (keep its sets/reps/weight/rest and
// its logged sets — they stay attached to the entry). The generator-provided
// alternatives belonged to the old movement, so we clear them and reset any
// active swap; the new pick becomes the entry's exercise outright.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const userId = await getUserId();
    const { entryId } = await params;
    const id = parseId(entryId);
    if (id === null) {
      return NextResponse.json({ error: "Invalid exercise id." }, { status: 400 });
    }
    if (!(await entryBelongsToUser(userId, id))) {
      return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
    }

    const sel = exerciseSelectionSchema.parse(await req.json());
    const check = await validateSelection(userId, sel);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    await db
      .update(exerciseEntries)
      .set({
        exerciseId: sel.exerciseId,
        nameOverride: sel.exerciseId ? null : (sel.nameOverride?.trim() || null),
        activeAltIndex: null,
        alternatives: [],
        unverified: false,
      })
      .where(eq(exerciseEntries.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("change exercise error:", err);
    const message = err instanceof Error ? err.message : "Failed to change exercise.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Remove an entry the user no longer wants. Its set logs cascade-delete with it.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const userId = await getUserId();
    const { entryId } = await params;
    const id = parseId(entryId);
    if (id === null) {
      return NextResponse.json({ error: "Invalid exercise id." }, { status: 400 });
    }
    if (!(await entryBelongsToUser(userId, id))) {
      return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
    }

    await db.delete(exerciseEntries).where(eq(exerciseEntries.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete exercise error:", err);
    const message = err instanceof Error ? err.message : "Failed to remove exercise.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
