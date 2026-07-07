import { NextRequest, NextResponse } from "next/server";
import { USER_ID_COOKIE, userIdCookieOptions } from "@/lib/cookies";

// Anonymous identity: every visitor gets a stable gymsnap_uid cookie the first
// time they hit the app. No login screens — opening the site "logs you in" as
// an anonymous user, and all their data is scoped to this id.
export function middleware(request: NextRequest) {
  const existing = request.cookies.get(USER_ID_COOKIE)?.value;
  if (existing) return NextResponse.next();

  const uid = crypto.randomUUID();

  // Make the new id visible to server components / route handlers on THIS same
  // request (they read cookies() off the forwarded request), then also send it
  // to the browser so it persists on subsequent requests.
  request.cookies.set(USER_ID_COOKIE, uid);
  const response = NextResponse.next({ request });
  response.cookies.set(USER_ID_COOKIE, uid, userIdCookieOptions());
  return response;
}

export const config = {
  // Run on everything except Next internals and static assets. API routes are
  // intentionally included so the cookie is present in route handlers too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json).*)"],
};
