import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/user";
import { getLatestMenu, getMenuByNumber, getMenuSummary } from "@/lib/menu-data";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const weekParam = req.nextUrl.searchParams.get("week");
    const [menu, summary] = await Promise.all([
      weekParam ? getMenuByNumber(userId, Number(weekParam)) : getLatestMenu(userId),
      getMenuSummary(userId),
    ]);
    return NextResponse.json({ menu, summary });
  } catch (err) {
    return jsonError(err, "Failed to load your menu.");
  }
}
