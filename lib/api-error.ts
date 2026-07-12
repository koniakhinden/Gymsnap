import { NextResponse } from "next/server";

// Consistent error responses: always JSON, always log the real detail
// server-side, but only expose it to the client in development. In production
// the user sees a clean, generic message (no SQL/stack/internal paths leaking).
//
// Usage inside a route's catch:
//   } catch (err) { return jsonError(err, "Failed to load your plan."); }
export function jsonError(
  err: unknown,
  userMessage: string,
  status = 500
): NextResponse {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error(userMessage, detail);
  const showDetail = process.env.NODE_ENV !== "production";
  return NextResponse.json(
    { error: showDetail ? `${userMessage} — ${detail}` : userMessage },
    { status }
  );
}
