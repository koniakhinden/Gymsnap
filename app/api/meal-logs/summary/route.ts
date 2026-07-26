import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mealLogs } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { jsonError } from "@/lib/api-error";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export const runtime = "nodejs";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

type DayTotals = {
  day: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  entries: number;
};

// Per-day food totals over an inclusive [from, to] date range, for the weekly /
// monthly report. ISO day strings sort lexicographically, so a string range
// filter is a correct date range. The set is bounded (≤ ~31 days of meals), so
// we aggregate in JS rather than lean on SQL SUM typing.
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    if (!from || !to || !ISO_DAY.test(from) || !ISO_DAY.test(to)) {
      return NextResponse.json(
        { error: "Provide from and to as YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(mealLogs)
      .where(
        and(eq(mealLogs.userId, userId), gte(mealLogs.day, from), lte(mealLogs.day, to))
      )
      .orderBy(asc(mealLogs.day), asc(mealLogs.id));

    const byDay = new Map<string, DayTotals>();
    for (const l of rows) {
      const d = byDay.get(l.day) ?? {
        day: l.day,
        calories: 0,
        proteinG: 0,
        fatG: 0,
        carbG: 0,
        entries: 0,
      };
      d.calories += l.calories;
      d.proteinG += l.proteinG;
      d.fatG += l.fatG;
      d.carbG += l.carbG;
      d.entries += 1;
      byDay.set(l.day, d);
    }

    const days = [...byDay.values()];
    const daysLogged = days.length;
    const totals = days.reduce(
      (t, d) => ({
        calories: t.calories + d.calories,
        proteinG: t.proteinG + d.proteinG,
        fatG: t.fatG + d.fatG,
        carbG: t.carbG + d.carbG,
      }),
      { calories: 0, proteinG: 0, fatG: 0, carbG: 0 }
    );
    // Averages are over days that actually have entries (empty days don't drag
    // the average down — that would misrepresent "what did I eat on a logged day").
    const avg = daysLogged
      ? {
          calories: Math.round(totals.calories / daysLogged),
          proteinG: Math.round(totals.proteinG / daysLogged),
          fatG: Math.round(totals.fatG / daysLogged),
          carbG: Math.round(totals.carbG / daysLogged),
        }
      : { calories: 0, proteinG: 0, fatG: 0, carbG: 0 };

    return NextResponse.json({ from, to, days, daysLogged, totals, avg });
  } catch (err) {
    return jsonError(err, "Failed to load your food report.");
  }
}
