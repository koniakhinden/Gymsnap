import { NextResponse } from "next/server";
import { getAllWeeksSummary } from "@/lib/plan-data";
import { getUserId } from "@/lib/user";
import { jsonError } from "@/lib/api-error";

export async function GET() {
  try {
    const userId = await getUserId();
    const weeksSummary = await getAllWeeksSummary(userId);
    return NextResponse.json({ weeks: weeksSummary });
  } catch (err) {
    return jsonError(err, "Failed to load your weeks.");
  }
}
