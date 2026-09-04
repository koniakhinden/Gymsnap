import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exercises } from "@/lib/db/schema";
import { jsonError } from "@/lib/api-error";
import { localOnlyGuard } from "@/lib/local-only";
import { generateSpec, SPEC_COLUMNS } from "@/lib/image-spec";

export const runtime = "nodejs";
// Claude answers in seconds, but the retry gives it up to three attempts.
export const maxDuration = 120;

// Compute one exercise's drawing spec. Costs Anthropic tokens (cents), not the
// dollars an image render costs — this is the cheap step, and it has to happen
// before anything can be drawn at all.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = localOnlyGuard();
  if (blocked) return blocked;

  try {
    const { id } = await params;
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set in .env.local." },
        { status: 503 }
      );
    }

    const [ex] = await db.select(SPEC_COLUMNS).from(exercises).where(eq(exercises.id, id)).limit(1);
    if (!ex) return NextResponse.json({ error: "Unknown exercise." }, { status: 404 });

    const spec = await generateSpec(ex);
    return NextResponse.json({ spec });
  } catch (err) {
    return jsonError(err, "Spec generation failed.");
  }
}
