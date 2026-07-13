import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mealLogs } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { jsonError } from "@/lib/api-error";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const num = Number(id);
    if (!Number.isInteger(num) || num < 1) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }
    await db.delete(mealLogs).where(and(eq(mealLogs.id, num), eq(mealLogs.userId, userId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, "Failed to remove the entry.", 400);
  }
}
