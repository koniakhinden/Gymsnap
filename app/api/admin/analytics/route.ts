import { NextRequest, NextResponse } from "next/server";
import { getAdminAnalytics } from "@/lib/admin-data";

export const runtime = "nodejs";

// Owner-only usage analytics. Gated by a shared secret in ADMIN_KEY (env). This
// is a lightweight beta gate, not full auth — anyone with the key can read
// aggregate usage (no personal content is exposed, only counts + short ids).
export async function GET(req: NextRequest) {
  const configured = process.env.ADMIN_KEY;
  if (!configured) {
    return NextResponse.json(
      { error: "Admin analytics not configured. Set ADMIN_KEY in the environment." },
      { status: 503 }
    );
  }

  const provided =
    req.headers.get("x-admin-key") ??
    new URL(req.url).searchParams.get("key") ??
    "";
  if (provided !== configured) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const data = await getAdminAnalytics();
    return NextResponse.json(data);
  } catch (err) {
    console.error("admin analytics error:", err);
    return NextResponse.json({ error: "Failed to load analytics." }, { status: 500 });
  }
}
