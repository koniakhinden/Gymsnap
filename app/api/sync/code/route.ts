import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncCodes } from "@/lib/db/schema";
import { getUserId } from "@/lib/user";
import { lt } from "drizzle-orm";

export const runtime = "nodejs";

// Codes are read aloud / typed between devices, so the alphabet excludes
// easily-confused characters (0/O, 1/I/L).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000;

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export async function POST() {
  try {
    const userId = await getUserId();
    const nowMs = Date.now();

    // Opportunistically clear expired codes so the table stays tiny.
    await db.delete(syncCodes).where(lt(syncCodes.expiresAt, new Date(nowMs).toISOString()));

    const now = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + TTL_MS).toISOString();

    // Retry a few times on the tiny chance of a primary-key collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        await db.insert(syncCodes).values({ code, userId, expiresAt, createdAt: now });
        return NextResponse.json({ code, expiresAt });
      } catch {
        // collision — try another code
      }
    }
    return NextResponse.json(
      { error: "Couldn't generate a code. Please try again." },
      { status: 500 }
    );
  } catch (err) {
    console.error("sync code error:", err);
    return NextResponse.json({ error: "Couldn't generate a code." }, { status: 500 });
  }
}
