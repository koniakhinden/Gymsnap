// Deterministic calorie & macro engine. We compute targets in code (not via the
// LLM) so the numbers are trustworthy and consistent; the model only designs
// meals to roughly hit these targets.
//
// Safety: goals never program an extreme deficit. We cap the deficit and apply a
// per-sex minimum calorie floor. This is informational, not medical advice.

export type Sex = "male" | "female" | "other";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type NutritionGoal = "lose" | "maintain" | "gain";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2, // little/no exercise
  light: 1.375, // 1-3 days/week
  moderate: 1.55, // 3-5 days/week
  active: 1.725, // 6-7 days/week
  very_active: 1.9, // hard daily training / physical job
};

// Per-sex minimum daily calories — never program below these.
const CALORIE_FLOOR: Record<Sex, number> = {
  male: 1500,
  female: 1200,
  other: 1300,
};

const MAX_DEFICIT_FRACTION = 0.2; // at most 20% below maintenance
const SURPLUS_FRACTION = 0.12; // ~12% above maintenance for a lean gain

export type EaterInput = {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: NutritionGoal;
};

export type EaterTargets = {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
};

/** Mifflin-St Jeor BMR. "other" averages the male/female constants. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const sexConstant = sex === "male" ? 5 : sex === "female" ? -161 : (5 + -161) / 2;
  return base + sexConstant;
}

function round(n: number, step = 10): number {
  return Math.round(n / step) * step;
}

/** Full target set for one eater, with the safety floor applied. */
export function computeEaterTargets(e: EaterInput): EaterTargets {
  const b = bmr(e.sex, e.weightKg, e.heightCm, e.ageYears);
  const tdee = b * ACTIVITY_FACTOR[e.activity];

  let calories: number;
  if (e.goal === "lose") {
    calories = Math.max(tdee * (1 - MAX_DEFICIT_FRACTION), CALORIE_FLOOR[e.sex]);
  } else if (e.goal === "gain") {
    calories = tdee * (1 + SURPLUS_FRACTION);
  } else {
    calories = tdee;
  }
  calories = round(calories, 10);

  // Macros: protein from body weight (preserves muscle in a deficit), fat ~27%
  // of calories, carbs fill the remainder.
  const proteinG = round(1.6 * e.weightKg, 1);
  const fatG = round((0.27 * calories) / 9, 1);
  const carbG = Math.max(0, round((calories - proteinG * 4 - fatG * 9) / 4, 1));

  return {
    bmr: round(b, 1),
    tdee: round(tdee, 10),
    calories,
    proteinG,
    fatG,
    carbG,
  };
}

export type HouseholdTargets = {
  eaters: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  perEater: EaterTargets[];
};

/** Combined daily needs for a household (shared meals scaled to N eaters). */
export function computeHouseholdTargets(eaters: EaterInput[]): HouseholdTargets {
  const perEater = eaters.map(computeEaterTargets);
  const sum = (key: keyof EaterTargets) => perEater.reduce((t, p) => t + p[key], 0);
  return {
    eaters: eaters.length,
    calories: round(sum("calories"), 10),
    proteinG: round(sum("proteinG"), 1),
    fatG: round(sum("fatG"), 1),
    carbG: round(sum("carbG"), 1),
    perEater,
  };
}
