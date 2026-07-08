// GymSnap-authored bodyweight & variable-load exercises that don't exist in the
// upstream free-exercise-db. They exist so the generator can pick the right RUNG
// of a movement ladder (see lib/movement-patterns.ts) and hit a target subjective
// effort (RIR 2-3) instead of being forced into a fixed-equipment movement.
//
// Shape matches the `exercises` DB table (minus images, which we don't have for
// these). They are:
//   1) merged into getEligibleExercises() at runtime, so their ids are always
//      valid for the model even before the DB is re-seeded;
//   2) resolvable by hydrateWeek() for display;
//   3) inserted by scripts/seed.ts so the DB stays a complete source of truth.
//
// All entries use equipment the generator always allows ("body only" or "other"),
// so adding them never widens what real gym equipment unlocks.

export type CustomExercise = {
  id: string;
  name: string;
  equipment: "body only" | "other";
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  force: "push" | "pull" | "static" | null;
  mechanic: "compound" | "isolation";
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
};

export const CUSTOM_EXERCISES: CustomExercise[] = [
  // ---- PUSH ladder (easiest -> hardest) ----
  {
    id: "bw_wall_pushup",
    name: "Wall Push-Up",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    instructions: [
      "Stand facing a wall, arms straight, hands on the wall at chest height, shoulder-width apart.",
      "Step your feet back so your body is at a gentle angle — the more upright you stay, the easier it is.",
      "Bend the elbows to bring your chest toward the wall, then press back to the start.",
    ],
    images: [],
  },
  {
    id: "bw_high_incline_pushup",
    name: "High Incline Push-Up (windowsill/counter)",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    instructions: [
      "Place your hands on a high, stable surface (kitchen counter or windowsill).",
      "Walk your feet back into a straight-body plank at a steep angle.",
      "Lower your chest to the edge, then press back up. Raise the hands higher to make it easier.",
    ],
    images: [],
  },
  {
    id: "bw_low_incline_pushup",
    name: "Low Incline Push-Up (bench/chair)",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    instructions: [
      "Place your hands on a low, stable surface such as a sturdy chair seat or bench.",
      "Walk your feet back into a straight-body plank — lower support means more load.",
      "Lower your chest to the surface and press back up under control.",
    ],
    images: [],
  },
  {
    id: "bw_knee_pushup",
    name: "Knee Push-Up",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    instructions: [
      "Kneel on the floor and place your hands slightly wider than shoulder-width.",
      "Keep a straight line from knees to head, hips not sagging.",
      "Lower your chest toward the floor and press back up.",
    ],
    images: [],
  },
  {
    id: "bw_full_pushup",
    name: "Full Push-Up",
    equipment: "body only",
    category: "strength",
    level: "intermediate",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    instructions: [
      "Start in a plank on your hands and toes, body in a straight line.",
      "Lower your chest to just above the floor, elbows about 45 degrees from the body.",
      "Press back up to full arm extension.",
    ],
    images: [],
  },
  {
    id: "bw_feet_elevated_pushup",
    name: "Feet-Elevated Push-Up",
    equipment: "body only",
    category: "strength",
    level: "advanced",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    instructions: [
      "Set up a full push-up with your feet on a stable raised surface (step or chair).",
      "The higher the feet, the more load shifts onto the upper chest and shoulders.",
      "Lower under control and press back up, keeping the body rigid.",
    ],
    images: [],
  },

  // ---- PULL ladder (easiest -> hardest) + variable-load options ----
  {
    id: "bw_doorway_towel_row",
    name: "Doorway Towel Row",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "pull",
    mechanic: "compound",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps", "lats"],
    instructions: [
      "Loop a strong towel around a securely latched door edge, or grip both door frame sides.",
      "Stand close with feet near the base, hold the towel/frame and lean back with straight arms.",
      "Pull your chest toward your hands, squeezing the shoulder blades, then control back. Stand more upright to make it easier.",
    ],
    images: [],
  },
  {
    id: "bw_high_inverted_row",
    name: "High Inverted Row (near-vertical body)",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "pull",
    mechanic: "compound",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps", "lats"],
    instructions: [
      "Grip a high, sturdy horizontal edge (a secured bar or heavy table edge).",
      "Keep the body nearly upright — this loads only a small fraction of body weight.",
      "Pull your chest to the bar and lower under control. Lower the grip / walk feet forward to progress.",
    ],
    images: [],
  },
  {
    id: "bw_under_table_row",
    name: "Under-Table Row (Australian pull-up)",
    equipment: "body only",
    category: "strength",
    level: "intermediate",
    force: "pull",
    mechanic: "compound",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps", "lats", "forearms"],
    instructions: [
      "Lie under a sturdy, heavy table and grip its edge with both hands (test it holds your weight).",
      "Keep the body straight and heels on the floor; the more horizontal your torso, the harder it is.",
      "Pull your chest up to the table edge, pause, then lower slowly.",
    ],
    images: [],
  },
  {
    id: "bw_inverted_row_low",
    name: "Low Inverted Row (torso horizontal)",
    equipment: "body only",
    category: "strength",
    level: "advanced",
    force: "pull",
    mechanic: "compound",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps", "lats", "forearms"],
    instructions: [
      "Set a secured bar/edge at roughly hip height and hang underneath with a straight body.",
      "Feet forward so the torso is horizontal — this loads most of your body weight.",
      "Pull your sternum to the bar, squeeze, and lower with control.",
    ],
    images: [],
  },
  {
    id: "bw_backpack_row",
    name: "Backpack Row (variable load)",
    equipment: "other",
    category: "strength",
    level: "beginner",
    force: "pull",
    mechanic: "compound",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps", "lats"],
    instructions: [
      "Load a backpack with books to a challenging weight and hold it by the top handle or straps.",
      "Hinge forward with a flat back, one hand braced on a chair or thigh for support.",
      "Row the backpack to your hip, squeeze the shoulder blade, and lower. Add books to progress.",
    ],
    images: [],
  },
  {
    id: "bw_jug_row",
    name: "Water Jug / Canister Row (variable load)",
    equipment: "other",
    category: "strength",
    level: "beginner",
    force: "pull",
    mechanic: "compound",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps", "lats"],
    instructions: [
      "Fill a canister or water jug to a challenging weight and grip the handle.",
      "Hinge forward with a flat back, opposite hand braced for support.",
      "Row the jug to your hip and lower slowly. Add water to progress.",
    ],
    images: [],
  },

  // ---- SQUAT ladder (easiest -> hardest) ----
  {
    id: "bw_chair_sit_to_stand",
    name: "Chair Sit-to-Stand",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: [
      "Sit on a sturdy chair, feet flat, arms crossed or reaching forward.",
      "Stand up fully without using your hands, then sit back down under control.",
      "Use a higher seat or a light hand push to make it easier.",
    ],
    images: [],
  },
  {
    id: "bw_box_chair_squat",
    name: "Box / Chair Squat",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: [
      "Stand in front of a chair or box, feet shoulder-width.",
      "Sit back and down until you lightly touch the seat, then stand back up.",
      "The chair caps the depth and protects the knees; use a higher seat to reduce load.",
    ],
    images: [],
  },
  {
    id: "bw_assisted_squat",
    name: "Assisted Squat (hold support)",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: [
      "Hold a sturdy support (door frame, heavy furniture) with both hands.",
      "Squat down to a comfortable depth, using the arms only as much as needed.",
      "Drive up through the heels. Use less arm assistance to progress.",
    ],
    images: [],
  },
  {
    id: "bw_bodyweight_squat",
    name: "Bodyweight Squat",
    equipment: "body only",
    category: "strength",
    level: "intermediate",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: [
      "Stand with feet shoulder-width, toes slightly out.",
      "Sit back and down to a comfortable depth, knees tracking over the toes.",
      "Drive up through the heels to standing.",
    ],
    images: [],
  },
  {
    id: "bw_wall_sit",
    name: "Wall Sit",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "static",
    mechanic: "compound",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes"],
    instructions: [
      "Lean your back flat against a wall and slide down until knees are bent (higher = easier).",
      "Hold the position with thighs supported by the wall angle, weight through the heels.",
      "Hold for time; slide lower or hold longer to progress.",
    ],
    images: [],
  },

  // ---- HINGE ladder ----
  {
    id: "bw_glute_bridge",
    name: "Glute Bridge",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["glutes"],
    secondaryMuscles: ["hamstrings", "lower back"],
    instructions: [
      "Lie on your back, knees bent, feet flat and hip-width apart.",
      "Squeeze the glutes and lift the hips until the body forms a straight line from knees to shoulders.",
      "Pause at the top, then lower with control.",
    ],
    images: [],
  },
  {
    id: "bw_single_leg_glute_bridge",
    name: "Single-Leg Glute Bridge",
    equipment: "body only",
    category: "strength",
    level: "intermediate",
    force: "push",
    mechanic: "compound",
    primaryMuscles: ["glutes"],
    secondaryMuscles: ["hamstrings", "lower back"],
    instructions: [
      "Set up as a glute bridge, then extend one leg straight.",
      "Drive through the planted heel to lift the hips level, keeping them square.",
      "Lower under control and repeat, then switch legs.",
    ],
    images: [],
  },
  {
    id: "bw_bird_dog",
    name: "Bird Dog",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "static",
    mechanic: "compound",
    primaryMuscles: ["lower back"],
    secondaryMuscles: ["glutes", "abdominals"],
    instructions: [
      "Start on hands and knees, spine neutral.",
      "Extend the opposite arm and leg until level with the torso, without twisting the hips.",
      "Pause, return under control, and alternate sides.",
    ],
    images: [],
  },

  // ---- CORE ladder ----
  {
    id: "bw_dead_bug",
    name: "Dead Bug",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "static",
    mechanic: "compound",
    primaryMuscles: ["abdominals"],
    secondaryMuscles: ["lower back"],
    instructions: [
      "Lie on your back, arms reaching up, hips and knees bent to 90 degrees.",
      "Keeping the lower back pressed to the floor, lower the opposite arm and leg toward the floor.",
      "Return and alternate, moving slowly and controlling the ribcage.",
    ],
    images: [],
  },
  {
    id: "bw_plank_on_knees",
    name: "Plank on Knees",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "static",
    mechanic: "isolation",
    primaryMuscles: ["abdominals"],
    secondaryMuscles: ["lower back", "shoulders"],
    instructions: [
      "Set up a forearm plank but rest on your knees instead of your toes.",
      "Keep a straight line from knees to head, bracing the abs and glutes.",
      "Hold for time; move to a full plank to progress.",
    ],
    images: [],
  },
  {
    id: "bw_side_plank_on_knees",
    name: "Side Plank on Knees",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "static",
    mechanic: "isolation",
    primaryMuscles: ["abdominals"],
    secondaryMuscles: ["obliques"],
    instructions: [
      "Lie on your side propped on one forearm, knees bent and stacked.",
      "Lift the hips so the body is straight from knees to head.",
      "Hold for time, then switch sides. Straighten the legs to progress.",
    ],
    images: [],
  },
  {
    id: "bw_plank",
    name: "Plank",
    equipment: "body only",
    category: "strength",
    level: "intermediate",
    force: "static",
    mechanic: "isolation",
    primaryMuscles: ["abdominals"],
    secondaryMuscles: ["lower back", "shoulders"],
    instructions: [
      "Rest on your forearms and toes with the body in a straight line.",
      "Brace the abs and glutes; don't let the hips sag or pike.",
      "Hold for time.",
    ],
    images: [],
  },
  {
    id: "bw_side_plank",
    name: "Side Plank",
    equipment: "body only",
    category: "strength",
    level: "intermediate",
    force: "static",
    mechanic: "isolation",
    primaryMuscles: ["abdominals"],
    secondaryMuscles: ["obliques"],
    instructions: [
      "Prop on one forearm with legs straight and feet stacked.",
      "Lift the hips into a straight line and hold, keeping the top hip from dropping.",
      "Hold for time, then switch sides.",
    ],
    images: [],
  },

  // ---- CALF ladder ----
  {
    id: "bw_two_leg_calf_raise",
    name: "Two-Leg Calf Raise",
    equipment: "body only",
    category: "strength",
    level: "beginner",
    force: "push",
    mechanic: "isolation",
    primaryMuscles: ["calves"],
    secondaryMuscles: [],
    instructions: [
      "Stand tall, optionally with fingertips on a wall for balance.",
      "Rise onto the balls of both feet as high as possible, pause, then lower slowly.",
      "Use a step edge for a bigger range of motion.",
    ],
    images: [],
  },
  {
    id: "bw_single_leg_calf_raise",
    name: "Single-Leg Calf Raise",
    equipment: "body only",
    category: "strength",
    level: "intermediate",
    force: "push",
    mechanic: "isolation",
    primaryMuscles: ["calves"],
    secondaryMuscles: [],
    instructions: [
      "Balance on one foot, fingertips on a wall for support.",
      "Rise onto the ball of the foot as high as possible, pause, and lower slowly.",
      "Repeat, then switch legs.",
    ],
    images: [],
  },
];

// Reuse free-exercise-db illustrations for the closest matching movement so the
// ladder rungs aren't picture-less. Paths resolve against the same GitHub raw
// host as every other exercise image (see components/ImageLightbox). Only mapped
// where the borrowed frame faithfully depicts the movement; a few (wall sit,
// bird dog, calf raises) have no faithful match and stay picture-less.
const REFERENCE_IMAGES: Record<string, string[]> = {
  // push
  bw_wall_pushup: ["Incline_Push-Up/0.jpg", "Incline_Push-Up/1.jpg"],
  bw_high_incline_pushup: ["Incline_Push-Up/0.jpg", "Incline_Push-Up/1.jpg"],
  bw_low_incline_pushup: ["Incline_Push-Up_Medium/0.jpg", "Incline_Push-Up_Medium/1.jpg"],
  bw_knee_pushup: ["Pushups/0.jpg", "Pushups/1.jpg"],
  bw_full_pushup: ["Pushups/0.jpg", "Pushups/1.jpg"],
  bw_feet_elevated_pushup: ["Decline_Push-Up/0.jpg", "Decline_Push-Up/1.jpg"],
  // pull
  bw_high_inverted_row: ["Inverted_Row/0.jpg", "Inverted_Row/1.jpg"],
  bw_doorway_towel_row: ["Inverted_Row/0.jpg", "Inverted_Row/1.jpg"],
  bw_under_table_row: ["Inverted_Row/0.jpg", "Inverted_Row/1.jpg"],
  bw_inverted_row_low: ["Inverted_Row/0.jpg", "Inverted_Row/1.jpg"],
  bw_backpack_row: ["One-Arm_Dumbbell_Row/0.jpg", "One-Arm_Dumbbell_Row/1.jpg"],
  bw_jug_row: ["One-Arm_Dumbbell_Row/0.jpg", "One-Arm_Dumbbell_Row/1.jpg"],
  // squat
  bw_chair_sit_to_stand: ["Bodyweight_Squat/0.jpg", "Bodyweight_Squat/1.jpg"],
  bw_box_chair_squat: ["Bodyweight_Squat/0.jpg", "Bodyweight_Squat/1.jpg"],
  bw_assisted_squat: ["Bodyweight_Squat/0.jpg", "Bodyweight_Squat/1.jpg"],
  bw_bodyweight_squat: ["Bodyweight_Squat/0.jpg", "Bodyweight_Squat/1.jpg"],
  // hinge
  bw_glute_bridge: ["Butt_Lift_Bridge/0.jpg", "Butt_Lift_Bridge/1.jpg"],
  bw_single_leg_glute_bridge: ["Single_Leg_Glute_Bridge/0.jpg", "Single_Leg_Glute_Bridge/1.jpg"],
  // core
  bw_dead_bug: ["Dead_Bug/0.jpg", "Dead_Bug/1.jpg"],
  bw_plank_on_knees: ["Plank/0.jpg", "Plank/1.jpg"],
  bw_side_plank_on_knees: ["Side_Bridge/0.jpg", "Side_Bridge/1.jpg"],
  bw_plank: ["Plank/0.jpg", "Plank/1.jpg"],
  bw_side_plank: ["Side_Bridge/0.jpg", "Side_Bridge/1.jpg"],
};

for (const ex of CUSTOM_EXERCISES) {
  const imgs = REFERENCE_IMAGES[ex.id];
  if (imgs) ex.images = imgs;
}

export const CUSTOM_BY_ID: Record<string, CustomExercise> = Object.fromEntries(
  CUSTOM_EXERCISES.map((e) => [e.id, e])
);
