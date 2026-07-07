import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { profileInputSchema } from "@/lib/validation/profile";
import { desc } from "drizzle-orm";

export async function GET() {
  const profile = db.select().from(profiles).orderBy(desc(profiles.id)).limit(1).get();
  return NextResponse.json({ profile: profile ?? null });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = profileInputSchema.parse(body);
    const now = new Date().toISOString();
    const profile = db
      .insert(profiles)
      .values({ ...parsed, updatedAt: now })
      .returning()
      .get();
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("save profile error:", err);
    const message = err instanceof Error ? err.message : "Failed to save profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
