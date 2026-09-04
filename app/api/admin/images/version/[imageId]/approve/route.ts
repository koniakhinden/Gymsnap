import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error";
import { localOnlyGuard } from "@/lib/local-only";
import { approveImage } from "@/lib/image-generation";

export const runtime = "nodejs";

// Promote a pending render: it becomes active, the incumbent is archived.
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
    return jsonError(err, "Failed to approve the image.");
  }
}
