import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exerciseEntries } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { entryBelongsToUser } from "@/lib/plan-data";

// Swap a planned exercise to one of its listed alternatives, or back to the
// original. altIndex is an index into the entry's `alternatives` array; null
// reverts to the originally prescribed exercise. The choice persists on the
// entry, and set logs stay attached to the entry either way.
const swapSchema = z.object({
  altIndex: z.number().int().min(0).max(2).nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const userId = await getUserId();
    const { entryId } = await params;
    const id = Number(entryId);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Invalid exercise id." }, { status: 400 });
    }

    // Can't swap an exercise you don't own.
    if (!(await entryBelongsToUser(userId, id))) {
      return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
    }

    const { altIndex } = swapSchema.parse(await req.json());

    // Guard the index against the entry's actual alternatives so we never point
    // at a slot that doesn't exist.
    if (altIndex !== null) {
      const [entry] = await db
        .select({ alternatives: exerciseEntries.alternatives })
        .from(exerciseEntries)
        .where(eq(exerciseEntries.id, id))
        .limit(1);
      const count = entry?.alternatives?.length ?? 0;
      if (altIndex >= count) {
        return NextResponse.json({ error: "No such alternative." }, { status: 400 });
      }
    }

    await db
      .update(exerciseEntries)
      .set({ activeAltIndex: altIndex })
      .where(eq(exerciseEntries.id, id));

    return NextResponse.json({ ok: true, activeAltIndex: altIndex });
  } catch (err) {
    console.error("swap exercise error:", err);
    const message = err instanceof Error ? err.message : "Failed to swap exercise.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
