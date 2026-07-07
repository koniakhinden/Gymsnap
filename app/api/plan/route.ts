import { NextRequest, NextResponse } from "next/server";
import { getLatestWeek, getWeekByNumber, getLatestProfile } from "@/lib/plan-data";
import { getUserId } from "@/lib/user";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  const weekParam = req.nextUrl.searchParams.get("week");
  const [week, profile] = await Promise.all([
    weekParam
      ? getWeekByNumber(userId, Number(weekParam))
      : getLatestWeek(userId),
    getLatestProfile(userId),
  ]);
  return NextResponse.json({ week, weightUnit: profile?.weightUnit ?? "kg" });
}
