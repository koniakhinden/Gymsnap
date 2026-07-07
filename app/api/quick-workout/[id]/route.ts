import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quickWorkouts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hydrateQuickWorkout } from "@/lib/quick-workout-data";
import type { QuickWorkout } from "@/lib/validation/quick-workout";

// Returns a saved quick workout with exercise images/equipment attached,
// so past sessions can be reopened from the Recent list.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const num = Number(id);
    if (!Number.isInteger(num) || num < 1) {
      return NextResponse.json({ error: "Invalid workout id." }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(quickWorkouts)
      .where(eq(quickWorkouts.id, num))
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Workout not found." }, { status: 404 });
    }

    const workout = await hydrateQuickWorkout(rows[0].result as QuickWorkout);
    return NextResponse.json({ workout });
  } catch (err) {
    console.error("get quick workout error:", err);
    return NextResponse.json({ error: "Failed to load the workout." }, { status: 500 });
  }
}
