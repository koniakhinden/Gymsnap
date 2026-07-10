import { NextRequest, NextResponse } from "next/server";
import { getUserPrograms } from "@/lib/admin-data";

export const runtime = "nodejs";

// Owner-only: the full generated programs (weekly plans + quick workouts) for a
// single user. Same ADMIN_KEY gate as the analytics endpoint.
export async function GET(req: NextRequest) {
  const configured = process.env.ADMIN_KEY;
  if (!configured) {
    return NextResponse.json(
      { error: "Admin analytics not configured. Set ADMIN_KEY in the environment." },
      { status: 503 }
    );
  }

  const provided =
    req.headers.get("x-admin-key") ?? new URL(req.url).searchParams.get("key") ?? "";
  if (provided !== configured) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  try {
    const data = await getUserPrograms(userId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("admin user programs error:", err);
    return NextResponse.json({ error: "Failed to load user programs." }, { status: 500 });
  }
}
