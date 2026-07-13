import { NextRequest, NextResponse } from "next/server";
import { ClaudeError } from "@/lib/anthropic";
import { validateUploadedFiles } from "@/lib/equipment-recognition";
import { recognizeMealFromFiles } from "@/lib/meal-recognition";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceAiRateLimit(req, "meal-recognize");
    if (limited) return limited;

    const formData = await req.formData();
    const files = formData.getAll("photos").filter((f): f is File => f instanceof File);

    const validationError = validateUploadedFiles(files);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const meal = await recognizeMealFromFiles(files);
    return NextResponse.json({ meal });
  } catch (err) {
    if (err instanceof ClaudeError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return jsonError(err, "Couldn't read the food photo.");
  }
}
