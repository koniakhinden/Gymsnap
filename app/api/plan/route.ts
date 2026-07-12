import { NextRequest, NextResponse } from "next/server";
import { getLatestWeek, getWeekByNumber, getLatestProfile } from "@/lib/plan-data";
import { getUserId } from "@/lib/user";
import { jsonError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const weekParam = req.nextUrl.searchParams.get("week");
    const [week, profile] = await Promise.all([
      weekParam
        ? getWeekByNumber(userId, Number(weekParam))
        : getLatestWeek(userId),
      getLatestProfile(userId),
    ]);
    return NextResponse.json({ week, weightUnit: profile?.weightUnit ?? "kg" });
  } catch (err) {
    // Always return JSON so the client never chokes on an HTML/text error page.
    // A common cause here is a pending DB migration (missing columns).
    return jsonError(err, "Failed to load your plan.");
  }
}
