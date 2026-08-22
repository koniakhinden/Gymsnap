import { NextResponse } from "next/server";
import { getUserId } from "@/lib/user";
import { getLatestGymWithEquipment } from "@/lib/plan-data";
import { getEligibleExercises } from "@/lib/exercises";

export const runtime = "nodejs";

// Powers the manual "add / change exercise" picker (the muscle -> equipment ->
// exercise tree and its free-text search). Returns exactly the exercises this
// user's gym unlocks — same eligibility rules the plan generator uses — plus the
// always-available bodyweight / ladder moves, so the picker can never offer a
// movement the user has no equipment for.
export async function GET() {
  try {
    const userId = await getUserId();
    const gymData = await getLatestGymWithEquipment(userId);
    const items = gymData?.items ?? [];
    const eligible = await getEligibleExercises(
      items.map((i) => ({ name: i.name, category: i.category, details: i.details }))
    );
    const options = eligible
      .map((e) => ({
        id: e.id,
        name: e.name,
        equipment: e.equipment,
        primaryMuscles: e.primaryMuscles ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ options });
  } catch (err) {
    console.error("exercise options error:", err);
    return NextResponse.json({ error: "Failed to load exercises." }, { status: 500 });
  }
}
