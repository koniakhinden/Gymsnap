import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { weeks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Deleting a week cascades to its days, exercise entries, and check-ins
// (onDelete: "cascade" in the schema).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ weekNumber: string }> }
) {
  try {
    const { weekNumber } = await params;
    const num = Number(weekNumber);
    if (!Number.isInteger(num) || num < 1) {
      return NextResponse.json({ error: "Invalid week number." }, { status: 400 });
    }

    const deleted = await db.delete(weeks).where(eq(weeks.weekNumber, num)).returning();
    if (deleted.length === 0) {
      return NextResponse.json({ error: `Week ${num} not found.` }, { status: 404 });
    }
    return NextResponse.json({ deletedWeekNumber: num });
  } catch (err) {
    console.error("delete week error:", err);
    return NextResponse.json({ error: "Failed to delete the week." }, { status: 500 });
  }
}
