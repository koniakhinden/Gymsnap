import type { eaters as eatersTable, nutritionSettings } from "./db/schema";
import { computeEaterTargets } from "./nutrition";

type Eater = typeof eatersTable.$inferSelect;
type Settings = typeof nutritionSettings.$inferSelect;

export function buildMenuSystemPrompt(): string {
  return `You are GymSnap's weekly meal planner. You design a realistic 7-day home menu that hits each person's calorie target, fits their tastes, and is buildable from what's sold near them.

Hard rules:
1. Design SHARED meals for the household, scaled to the number of servings given. Portions can differ per person so each roughly hits their own daily calorie target; report "macrosPerServing" for one standard serving.
2. Hit the daily CALORIE TARGET reasonably for a standard serving (within ~10%). Prioritise protein toward the target given.
3. ALLERGIES ARE SAFETY-CRITICAL: never include a listed allergen or anything that commonly contains it. Respect ALL dietary restrictions (vegetarian, halal, etc.) and avoid disliked foods.
4. Lean into the stated cuisines and favorite foods — it's good to feature them even if a favorite isn't locally grown (e.g. buckwheat), as long as it's realistically buyable in that region.
5. LOCATION: build the menu from ingredients actually sold in that country/region's normal supermarket chains. For an item that isn't in mainstream stores but is available at a specialty/ethnic/European/Asian grocer, still use it if it fits their tastes — but mark it "store": "specialty" in the shopping list and add a short "note" on where to find it. Mainstream items get "store": "mainstream".
6. Keep meals simple and repeat some ingredients across days to reduce waste and cost, honoring the budget level.
7. Produce a CONSOLIDATED "shoppingList" for the whole week: de-duplicated, with amounts and a category, grouped logically. Assume basic staples (salt, pepper, oil, water, common spices) are on hand — don't list them.
8. Give each meal a "slot" (breakfast/lunch/dinner/snack), clear numbered "steps", a realistic "timeMin", and a per-serving macro estimate.
9. Respond only by calling the report_menu tool — no prose.`;
}

export function buildMenuUserMessage({
  eaters,
  settings,
}: {
  eaters: Eater[];
  settings: Settings | null;
}): string {
  const perEater = eaters.map((e) => {
    const t = computeEaterTargets({
      sex: e.sex,
      ageYears: e.ageYears,
      heightCm: e.heightCm,
      weightKg: e.weightKg,
      activity: e.activity,
      goal: e.goal,
    });
    const cals = settings?.calorieTargetOverride ?? t.calories;
    return `- ${e.name || "Person"}: ${cals} kcal/day (protein ~${t.proteinG} g), goal ${e.goal}`;
  });

  const restrictions = new Set<string>();
  const allergies = new Set<string>();
  for (const e of eaters) {
    for (const d of e.dietary ?? []) restrictions.add(d);
    for (const a of e.allergies ?? []) allergies.add(a);
  }

  const loc = [settings?.city, settings?.region, settings?.country].filter(Boolean).join(", ");
  const prefs: string[] = [];
  if (settings?.cuisines?.length) prefs.push(`Cuisines: ${settings.cuisines.join(", ")}.`);
  if (settings?.likes?.length) prefs.push(`Favorite foods (feature these): ${settings.likes.join(", ")}.`);
  if (settings?.dislikes?.length) prefs.push(`Avoid: ${settings.dislikes.join(", ")}.`);
  if (settings?.budgetLevel) prefs.push(`Budget: ${settings.budgetLevel}.`);

  return `Plan a 7-day menu.

SERVINGS PER MEAL: ${eaters.length || 1}

DAILY TARGETS (per person):
${perEater.length ? perEater.join("\n") : "No saved eaters — assume one adult at ~2000 kcal/day."}

DIETARY RESTRICTIONS (everyone): ${restrictions.size ? [...restrictions].join(", ") : "none"}
ALLERGIES — never include: ${allergies.size ? [...allergies].join(", ") : "none"}

LOCATION: ${loc || "not specified — assume a large North American supermarket"}

PREFERENCES:
${prefs.length ? prefs.join("\n") : "No specific preferences saved."}`;
}
