import { NextRequest, NextResponse } from "next/server";
import { getLatestWeek, getWeekByNumber, getLatestProfile } from "@/lib/plan-data";
import { getUserId } from "@/lib/user";

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
    console.error("load plan error:", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json(
      { error: `Failed to load your plan — ${detail}` },
      { status: 500 }
    );
  }
}
