import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error";
import { localOnlyGuard } from "@/lib/local-only";
import { approveImage } from "@/lib/image-generation";

export const runtime = "nodejs";

// Restore an archived version. Mechanically identical to approve — promote this
// row, archive whatever is active — but kept as its own route because it is a
// different intent, and the history view calls it from a different button.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const blocked = localOnlyGuard();
  if (blocked) return blocked;
  try {
    const { imageId } = await params;
    await approveImage(imageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, "Failed to roll back to that version.");
  }
}
