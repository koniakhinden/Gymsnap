import { notFound } from "next/navigation";
import { NextResponse } from "next/server";

/**
 * The image workbench is a local-only tool: it spends money on every click and
 * has no authentication of any kind. It must never be reachable on a deployed
 * build, so both the pages and their API routes are hard 404s in production.
 *
 * This is a build-time constant (NODE_ENV is inlined), so the check cannot be
 * flipped by a request header, a cookie, or a query parameter.
 */
export const LOCAL_TOOLS_ENABLED = process.env.NODE_ENV !== "production";

/** For pages/layouts: render the normal 404 page in production. */
export function assertLocalPage(): void {
  if (!LOCAL_TOOLS_ENABLED) notFound();
}

/** For route handlers: return a 404 in production, or null to carry on. */
export function localOnlyGuard(): NextResponse | null {
  if (LOCAL_TOOLS_ENABLED) return null;
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
