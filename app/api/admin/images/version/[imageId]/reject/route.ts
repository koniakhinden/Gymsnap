import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-error";
import { localOnlyGuard } from "@/lib/local-only";
import { rejectImage } from "@/lib/image-generation";

export const runtime = "nodejs";

const BodySchema = z.object({ note: z.string().max(500).optional() });

// Mark a render bad. Nothing is deleted — the exercise simply stops finding an
// active image and falls back to its free-exercise-db photos.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const blocked = localOnlyGuard();
  if (blocked) return blocked;
  try {
    const { imageId } = await params;
    const body = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    await rejectImage(imageId, body.data.note?.trim() || "rejected in review");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, "Failed to reject the image.");
  }
}
