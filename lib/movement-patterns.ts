// Movement-pattern ladders. The generator's job is to cover PATTERNS
// (push / pull / squat / hinge / core / calf) at a target subjective effort
// (RIR 2-3), not to "use whatever the equipment unlocks". Each ladder is an
// ordered list of exercise ids from EASIEST to HARDEST; the user is placed on
// the rung that matches their body weight and level. See lib/custom-exercises.ts
// for the movements themselves.

import type { GymEquipmentRef } from "./exercises";
import type { WeekPlan } from "./validation/plan";

export type MovementPattern = "push" | "pull" | "squat" | "hinge" | "core" | "calf";

type Ladder = {
  pattern: MovementPattern;
  // Easiest -> hardest. Ids resolve to real library / custom exercises.
  rungs: string[];
  note?: string;
};

export const MOVEMENT_LADDERS: Ladder[] = [
  {
    pattern: "push",
    rungs: [
      "bw_wall_pushup",
      "bw_high_incline_pushup",
      "bw_low_incline_pushup",
      "bw_knee_pushup",
      "bw_full_pushup",
      "bw_feet_elevated_pushup",
    ],
    note: "Dose with the support angle: the higher/more upright the hands, the lighter.",
  },
  {
    pattern: "pull",
    rungs: [
      "bw_high_inverted_row",
      "bw_doorway_towel_row",
      "bw_under_table_row",
      "bw_inverted_row_low",
    ],
    note: "Angle-scalable horizontal row: the more upright the torso, the lighter. Load is a fraction of body weight, so it never goes to near-zero the way a 3 kg dumbbell row does. Variable-load alternatives: bw_backpack_row, bw_jug_row.",
  },
  {
    pattern: "squat",
    rungs: [
      "bw_chair_sit_to_stand",
      "bw_box_chair_squat",
      "bw_assisted_squat",
      "bw_bodyweight_squat",
    ],
    note: "bw_wall_sit is an isometric regression for very heavy or deconditioned users. Prefer chair-capped depth to protect the knees.",
  },
  {
    pattern: "hinge",
    rungs: ["bw_glute_bridge", "bw_bird_dog", "bw_single_leg_glute_bridge"],
  },
  {
    pattern: "core",
    rungs: [
      "bw_dead_bug",
      "bw_plank_on_knees",
      "bw_side_plank_on_knees",
      "bw_plank",
      "bw_side_plank",
    ],
  },
  {
    pattern: "calf",
    rungs: ["bw_two_leg_calf_raise", "bw_single_leg_calf_raise"],
  },
];

/**
 * Compact, model-facing text describing the ladders. Injected into the plan
 * prompt so the model can pick the correct RUNG (target RIR 2-3) rather than a
 * fixed movement.
 */
export function buildLadderLibraryText(): string {
  const lines = MOVEMENT_LADDERS.map((l) => {
    const rungs = l.rungs.join(" -> ");
    const note = l.note ? `\n    (${l.note})` : "";
    return `- ${l.pattern} [easiest -> hardest]: ${rungs}${note}`;
  });
  return lines.join("\n");
}

// Equipment that carries a meaningful external load. Their presence means the
// gym is NOT minimal-load; their absence pushes us onto the bodyweight ladders.
const LOADED_EQUIPMENT = /barbell|machine|cable|smith|leg press|rack/i;

/**
 * True when the gym offers no meaningfully loadable equipment — only body weight
 * and/or light free weights (a couple of light dumbbells/kettlebells, bands).
 * In this mode, a fixed light weight (e.g. 3 kg) can't scale to a big body, so
 * angle-scaled bodyweight ladders must carry the session.
 */
export function isMinimalLoadGym(items: GymEquipmentRef[]): boolean {
  for (const item of items) {
    const text = `${item.name} ${item.details ?? ""} ${item.category}`;
    if (LOADED_EQUIPMENT.test(text)) return false;
  }
  return true;
}

/** First number in a plan weight string, or null for bodyweight / non-numeric. */
function parseWeightKgish(weight: string): number | null {
  if (!weight) return null;
  const lower = weight.toLowerCase();
  if (lower.includes("body") || lower.includes("bw")) return null;
  const m = weight.match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Free-weight equipment whose prescribed load can be so small it's ~no stimulus.
const LIGHT_FREE_WEIGHT = /dumbbell|kettlebell|e-?z (curl )?bar|band/i;

export type BalanceViolation = {
  dayLabel: string;
  exerciseId: string;
  weight: string;
  reason: string;
};

/**
 * Heuristic balance guard. A true per-exercise RIR needs difficulty metadata the
 * free library doesn't carry, so we don't fake a number. Instead we catch the
 * one unambiguous failure the ladders exist to prevent: a compound free-weight
 * movement prescribed with a load that is negligible relative to body weight
 * (e.g. a 3 kg dumbbell row for a 105 kg user) — effectively RIR ~5+, near-zero
 * stimulus. Those should become an angle-scaled bodyweight rung instead.
 */
export function findBalanceViolations(
  plan: WeekPlan,
  opts: {
    bodyWeightKg: number;
    equipmentById: Map<string, { equipment: string | null; mechanic: string | null }>;
  }
): BalanceViolation[] {
  const NEGLIGIBLE_FRACTION = 0.05; // <5% of body weight on a compound = near-zero
  const violations: BalanceViolation[] = [];
  for (const day of plan.days) {
    for (const ex of day.exercises) {
      if (!ex.exerciseId) continue;
      const meta = opts.equipmentById.get(ex.exerciseId);
      if (!meta?.equipment) continue;
      if (!LIGHT_FREE_WEIGHT.test(meta.equipment)) continue;
      // Isolation moves (curls, lateral raises) can be fine light; only flag
      // compounds, where near-zero load is clearly wrong.
      if (meta.mechanic && meta.mechanic !== "compound") continue;
      const w = parseWeightKgish(ex.weight);
      if (w == null) continue;
      if (w < opts.bodyWeightKg * NEGLIGIBLE_FRACTION) {
        violations.push({
          dayLabel: day.dayLabel,
          exerciseId: ex.exerciseId,
          weight: ex.weight,
          reason: `${ex.weight} on a compound is near-zero load for a ${Math.round(
            opts.bodyWeightKg
          )} kg user (RIR far above target)`,
        });
      }
    }
  }
  return violations;
}
