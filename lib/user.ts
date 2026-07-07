import { cookies } from "next/headers";
import { USER_ID_COOKIE } from "@/lib/cookies";

/**
 * Returns the current anonymous user's id from the gymsnap_uid cookie.
 * Works in both route handlers and server components. The middleware guarantees
 * the cookie exists on every request, so a missing cookie means middleware
 * isn't running for this path — surface that clearly instead of silently
 * leaking data across users.
 */
export async function getUserId(): Promise<string> {
  const store = await cookies();
  const uid = store.get(USER_ID_COOKIE)?.value;
  if (!uid) {
    throw new Error(
      "Missing gymsnap_uid cookie. The identity middleware did not run for this request."
    );
  }
  return uid;
}
