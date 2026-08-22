import { z } from "zod";
import { getLatestGymWithEquipment } from "./plan-data";
import { getEligibleExerciseIdSet } from "./exercises";

// A manual exercise pick from the add / change picker: either a library id the
// user's gym unlocks (with an image + instructions), or a free-text name typed
// by the user (custom movement, no library id).
export const exerciseSelectionSchema = z.object({
  exerciseId: z.string().nullable(),
  nameOverride: z.string().trim().max(120).nullable(),
});

export type ExerciseSelection = z.infer<typeof exerciseSelectionSchema>;

export async function validateSelection(
  userId: string,
  sel: ExerciseSelection
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hasId = !!sel.exerciseId;
  const hasName = !!(sel.nameOverride && sel.nameOverride.trim());
  if (!hasId && !hasName) {
    return { ok: false, error: "Pick an exercise or type a name." };
  }
  if (hasId) {
    const gym = await getLatestGymWithEquipment(userId);
    const ids = await getEligibleExerciseIdSet(
      (gym?.items ?? []).map((i) => ({
        name: i.name,
        category: i.category,
        details: i.details,
      }))
    );
    if (!ids.has(sel.exerciseId as string)) {
      return { ok: false, error: "That exercise isn't available with your equipment." };
    }
  }
  return { ok: true };
}
