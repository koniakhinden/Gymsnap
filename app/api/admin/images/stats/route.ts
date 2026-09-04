import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error";
import { localOnlyGuard } from "@/lib/local-only";
import { loadSpend } from "@/lib/image-admin";
import { IMAGE_COST_USD } from "@/lib/image-generation";

export const runtime = "nodejs";

// Estimated spend. NOT billing data — see loadSpend().
export async function GET() {
  const blocked = localOnlyGuard();
  if (blocked) return blocked;
  try {
    return NextResponse.json({ ...(await loadSpend()), pricing: IMAGE_COST_USD });
  } catch (err) {
    return jsonError(err, "Failed to load spend stats.");
  }
}
