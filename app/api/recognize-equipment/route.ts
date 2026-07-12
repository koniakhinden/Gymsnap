import { NextRequest, NextResponse } from "next/server";
import { ClaudeError } from "@/lib/anthropic";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-error";
import {
  recognizeEquipmentFromFiles,
  validateUploadedFiles,
} from "@/lib/equipment-recognition";

export const runtime = "nodejs";
// Claude vision on multiple photos takes 20-60s; the default function
// duration limit cuts the request off before it finishes.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceAiRateLimit(req, "recognize");
    if (limited) return limited;

    const formData = await req.formData();
    const files = formData.getAll("photos").filter((f): f is File => f instanceof File);

    const validationError = validateUploadedFiles(files);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { items, photoUrls } = await recognizeEquipmentFromFiles(files, "gym");
    return NextResponse.json({ items, photoUrls });
  } catch (err) {
    if (err instanceof ClaudeError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return jsonError(err, "Recognition failed.");
  }
}
