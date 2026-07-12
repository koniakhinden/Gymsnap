import { NextResponse } from "next/server";
import { getAllWeeksSummary } from "@/lib/plan-data";
import { getUserId } from "@/lib/user";

export async function GET() {
  try {
    const userId = await getUserId();
    const weeksSummary = await getAllWeeksSummary(userId);
    return NextResponse.json({ weeks: weeksSummary });
  } catch (err) {
    console.error("load weeks error:", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json(
      { error: `Failed to load your weeks — ${detail}` },
      { status: 500 }
    );
  }
}
