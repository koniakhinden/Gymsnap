import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { exercises } from "@/lib/db/schema";
import { jsonError } from "@/lib/api-error";
import { localOnlyGuard } from "@/lib/local-only";
import {
  DEFAULT_QUALITY,
  generateImage,
  getSpec,
  PermanentError,
} from "@/lib/image-generation";

export const runtime = "nodejs";
// A "high" render takes minutes; the shared module caps the upstream call at
// 600s, and this keeps the route from being torn down before it returns.
export const maxDuration = 800;

const BodySchema = z.object({
  quality: z.enum(["low", "medium", "high"]).optional(),
  // Lets the workbench render a hand-edited prompt without first persisting it.
  prompt: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = localOnlyGuard();
  if (blocked) return blocked;

  try {
    const { id } = await params;
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set in .env.local." },
        { status: 503 }
      );
    }

    const [ex] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
    if (!ex) return NextResponse.json({ error: "Unknown exercise." }, { status: 404 });

    const spec = await getSpec(id);
    if (!spec) {
      return NextResponse.json(
        { error: "No spec yet — run `images specs` for this exercise first." },
        { status: 400 }
      );
    }

    const body = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

    const row = await generateImage({
      exerciseId: id,
      exerciseName: ex.name,
      spec,
      quality: body.data.quality ?? DEFAULT_QUALITY,
      prompt: body.data.prompt,
    });
    return NextResponse.json({ image: row });
  } catch (err) {
    // A rejected prompt or a bad size is the operator's problem to see, not a
    // 500 to dig out of the server log.
    if (err instanceof PermanentError) {
      return jsonError(err, "OpenAI rejected the request.", 400);
    }
    return jsonError(err, "Generation failed.");
  }
}
