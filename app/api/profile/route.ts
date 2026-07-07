import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { profileInputSchema } from "@/lib/validation/profile";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(profiles).orderBy(desc(profiles.id)).limit(1);
  return NextResponse.json({ profile: rows[0] ?? null });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = profileInputSchema.parse(body);
    const now = new Date().toISOString();
    const [profile] = await db
      .insert(profiles)
      .values({ ...parsed, updatedAt: now })
      .returning();
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("save profile error:", err);
    const message = err instanceof Error ? err.message : "Failed to save profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
