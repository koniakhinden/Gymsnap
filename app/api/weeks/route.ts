import { NextResponse } from "next/server";
import { getAllWeeksSummary } from "@/lib/plan-data";

export async function GET() {
  const weeksSummary = await getAllWeeksSummary();
  return NextResponse.json({ weeks: weeksSummary });
}
