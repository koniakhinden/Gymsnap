import { NextRequest, NextResponse } from "next/server";
import { getLatestWeek, getWeekByNumber } from "@/lib/plan-data";

export async function GET(req: NextRequest) {
  const weekParam = req.nextUrl.searchParams.get("week");
  const week = weekParam ? await getWeekByNumber(Number(weekParam)) : await getLatestWeek();
  return NextResponse.json({ week });
}
