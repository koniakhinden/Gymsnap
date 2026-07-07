// Shared cookie constants. Kept dependency-free so both the edge middleware and
// node route handlers can import it without dragging runtime-specific code
// across the edge/node boundary.

export const USER_ID_COOKIE = "gymsnap_uid";

// 400 days is the max Chrome will honor for a cookie's max-age.
export const USER_ID_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export function userIdCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: USER_ID_COOKIE_MAX_AGE,
  };
}
