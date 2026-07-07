import { NextResponse } from "next/server";
import { getAllWeeksSummary } from "@/lib/plan-data";
import { getUserId } from "@/lib/user";

export async function GET() {
  const userId = await getUserId();
  const weeksSummary = await getAllWeeksSummary(userId);
  return NextResponse.json({ weeks: weeksSummary });
}
