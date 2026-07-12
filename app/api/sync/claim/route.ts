import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncCodes } from "@/lib/db/schema";
import { USER_ID_COOKIE, userIdCookieOptions } from "@/lib/cookies";
import { enforceRateLimit } from "@/lib/rate-limit";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// Claiming a code merges THIS device into the code owner's anonymous account:
// the gymsnap_uid cookie is re-pointed at the owner's id and the code is
// consumed. The claiming device's old (anonymous) data is simply left behind —
// no merge, per spec.
export async function POST(req: NextRequest) {
  try {
    // Codes are short; throttle claims so they can't be brute-forced.
    const limited = await enforceRateLimit(req, "sync-claim", 10, 10 * 60);
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "")
      .trim()
      .toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Enter a code." }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(syncCodes)
      .where(eq(syncCodes.code, code))
      .limit(1);
    const record = rows[0];
    if (!record) {
      return NextResponse.json(
        { error: "Code not found. Check it and try again." },
        { status: 404 }
      );
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await db.delete(syncCodes).where(eq(syncCodes.code, code));
      return NextResponse.json(
        { error: "This code has expired. Generate a new one on the other device." },
        { status: 410 }
      );
    }

    // Consume the code, then re-point this device's identity at the owner.
    await db.delete(syncCodes).where(eq(syncCodes.code, code));

    const response = NextResponse.json({ ok: true });
    response.cookies.set(USER_ID_COOKIE, record.userId, userIdCookieOptions());
    return response;
  } catch (err) {
    console.error("sync claim error:", err);
    return NextResponse.json({ error: "Couldn't sync this device." }, { status: 500 });
  }
}
