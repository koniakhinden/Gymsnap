import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/user";
import { getMealById } from "@/lib/cook-data";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const num = Number(id);
    if (!Number.isInteger(num) || num < 1) {
      return NextResponse.json({ error: "Invalid meal id." }, { status: 400 });
    }
    const meal = await getMealById(userId, num);
    if (!meal) {
      return NextResponse.json({ error: "Meal not found." }, { status: 404 });
    }
    return NextResponse.json({ meal });
  } catch (err) {
    return jsonError(err, "Failed to load the meal.");
  }
}
