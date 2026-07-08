import { db } from "./db";
import { exercises } from "./db/schema";
import { inArray, or, isNull, eq, sql } from "drizzle-orm";
import { CUSTOM_EXERCISES } from "./custom-exercises";

export type GymEquipmentRef = {
  name: string;
  category: "cardio" | "strength_machine" | "free_weights" | "accessories";
  details?: string | null;
};

const ALWAYS_ALLOWED_EQUIPMENT = ["body only", "other", null] as const;

const EQUIPMENT_MATCHERS: { tag: string; pattern: RegExp }[] = [
  { tag: "dumbbell", pattern: /dumbbell/i },
  { tag: "barbell", pattern: /barbell|olympic bar|half rack|power rack|squat rack/i },
  { tag: "kettlebells", pattern: /kettlebell/i },
  { tag: "cable", pattern: /cable|pulley|functional trainer|lat pull|pulldown|low row/i },
  // Deliberately strict: "band" alone also appears in descriptions of TRX
  // straps and the like, which would wrongly unlock band exercises.
  { tag: "bands", pattern: /resistance band|exercise band|mini ?band|loop band|booty band|thera-?band/i },
  { tag: "medicine ball", pattern: /medicine ball|med ball/i },
  { tag: "exercise ball", pattern: /exercise ball|stability ball|swiss ball/i },
  { tag: "e-z curl bar", pattern: /e-?z (curl )?bar/i },
  { tag: "foam roll", pattern: /foam roll/i },
];

// In the exercise library, equipment === "machine" means a specific dedicated
// machine (leg press, leg curl, smith...). A generic strength_machine gym item
// (usually a cable tower) must NOT unlock every machine exercise. A machine
// exercise is allowed only when the same machine type is matched BOTH in some
// gym item's text AND in the exercise name.
const MACHINE_TYPES: RegExp[] = [
  /smith/i,
  /leg press/i,
  /leg extension/i,
  /leg curl/i,
  /hack squat/i,
  /pec deck|butterfly|chest fly machine/i,
  /chest press|bench press machine/i,
  /shoulder press machine|machine shoulder/i,
  /calf (raise|press)/i,
  /assisted (pull-?up|chin|dip)/i,
  /row machine|seated row/i,
  /ab crunch machine|crunch machine/i,
  /hip (ab|ad)duct/i,
  /preacher curl machine/i,
];

// The "cable" tag would otherwise unlock every cable exercise in the library,
// including ones that need non-standard setups (cable deadlifts, cable squats,
// cable chest press between towers...). A basic pulley station (lat pulldown +
// low row + adjustable pulleys) reliably supports only these movements:
const CABLE_MOVEMENTS: RegExp[] = [
  /pull-?down/i,
  /\brow\b|rows\b/i,
  /push-?down/i,
  /face pull/i,
  /curl/i,
  /lateral raise|front raise/i,
  /rear delt/i,
  /reverse fl?ye?s?/i,
  /crunch/i,
  /triceps? extension/i,
  /pull-?through/i,
  /kickback/i,
  /shrug/i,
  /wood ?chop/i,
  /upright row/i,
  /external rotation|internal rotation/i,
];

function gymText(item: GymEquipmentRef): string {
  return `${item.name} ${item.details ?? ""} ${item.category}`;
}

// The custom ladder exercises are referenced by exerciseId in generated plans,
// and exercise_entries.exercise_id has a FK into exercises. Make sure the rows
// exist before we hand their ids to the model, so the app works without a
// manual re-seed. Runs once per process.
let customEnsured = false;
async function ensureCustomExercises() {
  if (customEnsured) return;
  // Upsert (not do-nothing) so definition changes — e.g. added illustrations —
  // propagate to rows that were inserted by an earlier version.
  await db
    .insert(exercises)
    .values(CUSTOM_EXERCISES)
    .onConflictDoUpdate({
      target: exercises.id,
      set: {
        name: sql`excluded.name`,
        equipment: sql`excluded.equipment`,
        category: sql`excluded.category`,
        level: sql`excluded.level`,
        force: sql`excluded.force`,
        mechanic: sql`excluded.mechanic`,
        primaryMuscles: sql`excluded.primary_muscles`,
        secondaryMuscles: sql`excluded.secondary_muscles`,
        instructions: sql`excluded.instructions`,
        images: sql`excluded.images`,
      },
    });
  customEnsured = true;
}

export function resolveAllowedEquipmentTags(gymItems: GymEquipmentRef[]): string[] {
  const tags = new Set<string>();
  for (const item of gymItems) {
    const text = gymText(item);
    for (const matcher of EQUIPMENT_MATCHERS) {
      if (matcher.pattern.test(text)) tags.add(matcher.tag);
    }
  }
  return [...tags];
}

export async function getEligibleExercises(gymItems: GymEquipmentRef[]) {
  await ensureCustomExercises();
  const tags = resolveAllowedEquipmentTags(gymItems);
  const hasCable = tags.includes("cable");
  const allowed = [...ALWAYS_ALLOWED_EQUIPMENT, ...tags].filter(
    (v): v is string => v !== null && v !== "cable"
  );

  const rows = await db
    .select()
    .from(exercises)
    .where(or(isNull(exercises.equipment), inArray(exercises.equipment, allowed)));

  const gymHaystack = gymItems.map(gymText).join(" | ");

  // Cable exercises: only basic pulley-station movements from the whitelist.
  let allowedCableRows: typeof rows = [];
  if (hasCable) {
    const cableRows = await db
      .select()
      .from(exercises)
      .where(eq(exercises.equipment, "cable"));
    allowedCableRows = cableRows.filter((ex) =>
      CABLE_MOVEMENTS.some((movement) => movement.test(ex.name))
    );
  }

  // Machine exercises: only those whose machine type is present in the gym.
  const machineRows = await db
    .select()
    .from(exercises)
    .where(eq(exercises.equipment, "machine"));
  const allowedMachineRows = machineRows.filter((ex) =>
    MACHINE_TYPES.some((type) => type.test(gymHaystack) && type.test(ex.name))
  );

  // GymSnap-authored bodyweight/variable-load movements (the ladder rungs). They
  // use only always-allowed equipment, so they're eligible in every gym. Merge
  // them in and de-dupe in case they've also been seeded into the DB.
  const seenIds = new Set([...rows, ...allowedCableRows, ...allowedMachineRows].map((r) => r.id));
  const customRows = CUSTOM_EXERCISES.filter((c) => !seenIds.has(c.id));

  return [...rows, ...allowedCableRows, ...allowedMachineRows, ...customRows];
}

export function formatExerciseCompactList(
  rows: { id: string; name: string; equipment: string | null; primaryMuscles: string[] }[]
): string {
  return rows
    .map((r) => {
      const muscles = (r.primaryMuscles ?? []).join(",");
      return `${r.id}\t${r.name}\t${r.equipment ?? "none"}\t${muscles}`;
    })
    .join("\n");
}
