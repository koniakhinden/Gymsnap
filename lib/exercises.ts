import { db } from "./db";
import { exercises } from "./db/schema";
import { inArray, or, isNull } from "drizzle-orm";

export type GymEquipmentRef = {
  name: string;
  category: "cardio" | "strength_machine" | "free_weights" | "accessories";
};

const ALWAYS_ALLOWED_EQUIPMENT = ["body only", "other", null] as const;

const EQUIPMENT_MATCHERS: { tag: string; pattern: RegExp }[] = [
  { tag: "dumbbell", pattern: /dumbbell/i },
  { tag: "barbell", pattern: /barbell/i },
  { tag: "kettlebells", pattern: /kettlebell/i },
  { tag: "cable", pattern: /cable/i },
  { tag: "machine", pattern: /machine|smith|leg press|lat pulldown/i },
  { tag: "bands", pattern: /band/i },
  { tag: "medicine ball", pattern: /medicine ball/i },
  { tag: "exercise ball", pattern: /exercise ball|stability ball|swiss ball/i },
  { tag: "e-z curl bar", pattern: /e-?z curl/i },
  { tag: "foam roll", pattern: /foam roll/i },
];

export function resolveAllowedEquipmentTags(gymItems: GymEquipmentRef[]): string[] {
  const tags = new Set<string>();
  for (const item of gymItems) {
    for (const matcher of EQUIPMENT_MATCHERS) {
      if (matcher.pattern.test(item.name) || matcher.pattern.test(item.category)) {
        tags.add(matcher.tag);
      }
    }
    if (item.category === "strength_machine") tags.add("machine");
    if (item.category === "free_weights") {
      // generic free weights mention without a specific matcher still unlocks dumbbell/barbell exercises
      if (/dumbbell/i.test(item.name)) tags.add("dumbbell");
      if (/barbell/i.test(item.name)) tags.add("barbell");
    }
  }
  return [...tags];
}

export async function getEligibleExercises(gymItems: GymEquipmentRef[]) {
  const tags = resolveAllowedEquipmentTags(gymItems);
  const allowed = [...ALWAYS_ALLOWED_EQUIPMENT, ...tags];
  const rows = await db
    .select()
    .from(exercises)
    .where(
      or(
        isNull(exercises.equipment),
        inArray(exercises.equipment, allowed.filter((v): v is string => v !== null))
      )
    );
  return rows;
}

export function formatExerciseCompactList(
  rows: { id: string; name: string; equipment: string | null; primaryMuscles: string }[]
): string {
  return rows
    .map((r) => {
      const muscles = JSON.parse(r.primaryMuscles || "[]").join(",");
      return `${r.id}\t${r.name}\t${r.equipment ?? "none"}\t${muscles}`;
    })
    .join("\n");
}
