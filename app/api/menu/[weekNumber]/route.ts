import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { menuWeeks } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { jsonError } from "@/lib/api-error";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ weekNumber: string }> }
) {
  try {
    const userId = await getUserId();
    const { weekNumber } = await params;
    const num = Number(weekNumber);
    if (!Number.isInteger(num) || num < 1) {
      return NextResponse.json({ error: "Invalid week number." }, { status: 400 });
    }
    const deleted = await db
      .delete(menuWeeks)
      .where(and(eq(menuWeeks.weekNumber, num), eq(menuWeeks.userId, userId)))
      .returning();
    if (deleted.length === 0) {
      return NextResponse.json({ error: `Week ${num} menu not found.` }, { status: 404 });
    }
    return NextResponse.json({ deletedWeekNumber: num });
  } catch (err) {
    return jsonError(err, "Failed to delete the menu.");
  }
}
