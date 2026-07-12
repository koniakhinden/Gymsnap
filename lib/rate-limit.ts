import { NextRequest, NextResponse } from "next/server";

// Lightweight rate limiting against Upstash Redis over its REST API — no SDK
// dependency, works on serverless. It FAILS OPEN: if Upstash isn't configured
// (env vars unset) or the limiter errors, requests are allowed through, so this
// can never take the app down. Configure by setting:
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// (create a free database at https://console.upstash.com).

const URL_ENV = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_ENV = process.env.UPSTASH_REDIS_REST_TOKEN;

// Default budget for the (expensive) AI endpoints, per identifier.
const AI_LIMIT = 20; // requests
const AI_WINDOW_SEC = 10 * 60; // per 10 minutes

/** Best-effort client IP from the proxy headers Vercel sets. */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

type RlResult = { ok: boolean; count: number; limit: number };

/** Fixed-window counter via Upstash REST pipeline (INCR + EXPIRE). */
async function hit(key: string, limit: number, windowSec: number): Promise<RlResult> {
  if (!URL_ENV || !TOKEN_ENV) return { ok: true, count: 0, limit }; // not configured → allow
  try {
    const windowId = Math.floor(Date.now() / 1000 / windowSec);
    const redisKey = `rl:${key}:${windowId}`;
    const res = await fetch(`${URL_ENV}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN_ENV}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSec)],
      ]),
      // Never let the limiter itself hang a request for long.
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return { ok: true, count: 0, limit }; // limiter error → allow
    const data = (await res.json()) as { result: number }[];
    const count = Number(data?.[0]?.result ?? 0);
    return { ok: count <= limit, count, limit };
  } catch {
    return { ok: true, count: 0, limit }; // fail open on any error
  }
}

/**
 * Enforce a per-IP budget for a named bucket. Returns a 429 JSON response to
 * return immediately, or null when the request may proceed. Fails open.
 */
export async function enforceRateLimit(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowSec: number
): Promise<NextResponse | null> {
  const { ok } = await hit(`${bucket}:${clientIp(req)}`, limit, windowSec);
  if (!ok) {
    return NextResponse.json(
      { error: "You're doing that a lot. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }
  return null;
}

/** The (expensive) AI endpoints share one budget per IP. */
export async function enforceAiRateLimit(
  req: NextRequest,
  bucket = "ai"
): Promise<NextResponse | null> {
  return enforceRateLimit(req, bucket, AI_LIMIT, AI_WINDOW_SEC);
}
