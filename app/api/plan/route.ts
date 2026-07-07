import { NextRequest, NextResponse } from "next/server";
import { getLatestWeek, getWeekByNumber } from "@/lib/plan-data";
import { getUserId } from "@/lib/user";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  const weekParam = req.nextUrl.searchParams.get("week");
  const week = weekParam
    ? await getWeekByNumber(userId, Number(weekParam))
    : await getLatestWeek(userId);
  return NextResponse.json({ week });
}
