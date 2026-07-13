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
7. USE WHAT THEY HAVE: if an "ALREADY ON HAND" list is given, plan meals to use those items first (especially anything they have a lot of), to cut waste and cost. In the "shoppingList", still list every ingredient the week needs, but set "have": true for items already on hand (these show under "Already have") and "have": false for items they must buy.
8. Produce a CONSOLIDATED "shoppingList" for the whole week: de-duplicated, with amounts and a category, grouped logically. Assume basic staples (salt, pepper, oil, water, common spices) are on hand — don't list them.
9. NEXT WEEK: fill "nextWeekSuggestions" with 2-4 short, FRIENDLY, non-pushy lines informed by what was on hand — e.g. if they had a lot of one thing (potatoes), suggest using it up or buying a bit less next time; if the mix looked unbalanced or wasteful, gently suggest one or two things to buy or try. Keep it light and optional, never preachy.
10. Give each meal a "slot" (breakfast/lunch/dinner/snack), a realistic "timeMin", and a per-serving macro estimate.
11. BE VERY CONCISE so the whole week generates fast and fits one response: exactly 3 meals per day (breakfast, lunch, dinner — no snacks). Each meal: a "description" of at most 6 words, and 2-3 short step lines of about 3-6 words each (terse imperative, no paragraphs). Keep ingredient lists and the shopping list tight. Brevity matters more than flourish.
12. Respond only by calling the report_menu tool — no prose.`;
}

type MenuDay = { dayLabel: string; meals: { name: string; ingredients: { name: string }[] }[] };

export function buildMenuUserMessage({
  eaters,
  settings,
  pantry,
  part = "final",
  priorDays = [],
}: {
  eaters: Eater[];
  settings: Settings | null;
  pantry: { name: string }[];
  part?: "days1" | "final";
  priorDays?: MenuDay[];
}): string {
  const task =
    part === "days1"
      ? `TASK: Produce ONLY days 1-4 (Monday-Thursday), as meals — fill just the "days" array (3 meals each: breakfast/lunch/dinner). Do NOT produce a title, shopping list, or suggestions in this step.`
      : `TASK: Days 1-4 are already planned (listed at the bottom). Now produce days 5-7 (Friday-Sunday) in "days", PLUS the whole-week "title", "servingsPerMeal", a CONSOLIDATED "shoppingList" covering ALL SEVEN days (days 1-4 below + your new days 5-7), "notes", and "nextWeekSuggestions".`;
  const priorBlock =
    part === "final" && priorDays.length
      ? `\n\nDAYS 1-4 ALREADY PLANNED (fold their ingredients into the shopping list):\n${priorDays
          .map(
            (d) =>
              `${d.dayLabel}: ${d.meals
                .map((m) => `${m.name} [${m.ingredients.map((i) => i.name).join(", ")}]`)
                .join("; ")}`
          )
          .join("\n")}`
      : "";
  const base = buildMenuBody({ eaters, settings, pantry });
  return `${task}\n\n${base}${priorBlock}`;
}

function buildMenuBody({
  eaters,
  settings,
  pantry,
}: {
  eaters: Eater[];
  settings: Settings | null;
  pantry: { name: string }[];
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

  return `Weekly menu context:

SERVINGS PER MEAL: ${eaters.length || 1}

DAILY TARGETS (per person):
${perEater.length ? perEater.join("\n") : "No saved eaters — assume one adult at ~2000 kcal/day."}

DIETARY RESTRICTIONS (everyone): ${restrictions.size ? [...restrictions].join(", ") : "none"}
ALLERGIES — never include: ${allergies.size ? [...allergies].join(", ") : "none"}

LOCATION: ${loc || "not specified — assume a large North American supermarket"}

PREFERENCES:
${prefs.length ? prefs.join("\n") : "No specific preferences saved."}

ALREADY ON HAND (use these first; mark them have:true in the shopping list):
${pantry.length ? pantry.map((p) => `- ${p.name}`).join("\n") : "(nothing photographed/listed — build a normal shop and set every shopping item have:false)"}`;
}
