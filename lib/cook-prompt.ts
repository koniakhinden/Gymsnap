import type { eaters as eatersTable, nutritionSettings } from "./db/schema";
import type { CookIngredientInput } from "./validation/cook";

type Eater = typeof eatersTable.$inferSelect;
type Settings = typeof nutritionSettings.$inferSelect;

const MEAL_LABEL: Record<string, string> = {
  any: "a meal",
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "a snack",
};

export function buildCookSystemPrompt(): string {
  return `You are GymSnap's home cooking assistant. Given the ingredients someone has RIGHT NOW, you suggest 1-3 realistic recipes they can cook immediately.

Hard rules:
1. Build recipes primarily from the AVAILABLE INGREDIENTS listed in the user message. You may assume basic staples are on hand (water, salt, pepper, cooking oil/butter, common dried spices) — do not list those as missing. Anything else that a recipe needs but isn't available goes in that recipe's "missingItems" (keep it short — 0-4 small items; if a recipe needs a lot of missing items, pick a different recipe).
2. ALLERGIES ARE SAFETY-CRITICAL: never include any listed allergen or an ingredient that commonly contains it. If the available ingredients themselves conflict with an allergy, simply don't use them.
3. Respect ALL dietary restrictions (e.g. vegetarian, halal, no pork) and avoid the disliked foods.
4. Honor the cuisine preferences and favorite foods where it makes sense — it's great to lean into them even if a favorite isn't strictly local.
5. Match the requested meal type and number of servings. Scale ingredient amounts to the servings.
6. Give realistic "timeMin", clear numbered "steps", and a per-serving macro estimate ("macrosPerServing": calories, proteinG, fatG, carbG). Macros are estimates — reasonable, not precise.
7. Keep it doable with a normal home kitchen. Prefer simple over fancy.
8. Use "cautions" only for genuine food-safety notes (e.g. cook chicken through) — not filler.
9. Respond only by calling the report_recipes tool — no prose.`;
}

function summarizeEaters(eaters: Eater[]): string {
  if (eaters.length === 0) return "No saved eater profiles.";
  const restrictions = new Set<string>();
  const allergies = new Set<string>();
  for (const e of eaters) {
    for (const d of e.dietary ?? []) restrictions.add(d);
    for (const a of e.allergies ?? []) allergies.add(a);
  }
  const lines = [
    `Cooking for ${eaters.length} ${eaters.length === 1 ? "person" : "people"}.`,
  ];
  if (restrictions.size > 0)
    lines.push(`Dietary restrictions (apply to everyone): ${[...restrictions].join(", ")}.`);
  lines.push(
    allergies.size > 0
      ? `ALLERGIES — never include these or anything containing them: ${[...allergies].join(", ")}.`
      : "No allergies reported."
  );
  return lines.join("\n");
}

export function buildCookUserMessage({
  ingredients,
  mealType,
  servings,
  note,
  eaters,
  settings,
  approxCaloriesPerServing,
}: {
  ingredients: CookIngredientInput[];
  mealType: string;
  servings: number;
  note: string;
  eaters: Eater[];
  settings: Settings | null;
  approxCaloriesPerServing: number | null;
}): string {
  const ingList =
    ingredients.length > 0
      ? ingredients.map((i) => `- ${i.name}${i.category ? ` (${i.category})` : ""}`).join("\n")
      : "(none provided — suggest something from common pantry staples only, and put main items in missingItems)";

  const prefs: string[] = [];
  if (settings?.cuisines?.length) prefs.push(`Cuisines they like: ${settings.cuisines.join(", ")}.`);
  if (settings?.likes?.length) prefs.push(`Favorite foods (lean into these): ${settings.likes.join(", ")}.`);
  if (settings?.dislikes?.length) prefs.push(`Avoid (dislikes): ${settings.dislikes.join(", ")}.`);

  return `Suggest ${MEAL_LABEL[mealType] ?? "a meal"} I can cook now.

AVAILABLE INGREDIENTS:
${ingList}

SERVINGS: ${servings}
${approxCaloriesPerServing ? `Aim for roughly ${approxCaloriesPerServing} kcal per serving (a guide, not strict).` : ""}

WHO'S EATING:
${summarizeEaters(eaters)}

PREFERENCES:
${prefs.length ? prefs.join("\n") : "No specific preferences saved."}
${note.trim() ? `\nExtra request from the user: "${note.trim()}"` : ""}`;
}
