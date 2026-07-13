import { z } from "zod";
import { macrosSchema, ingredientCategoryEnum } from "./cook";

export const mealSlotEnum = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const menuMealSchema = z.object({
  slot: mealSlotEnum,
  name: z.string().min(1),
  description: z.string().default(""),
  timeMin: z.number().int().min(1).max(240),
  ingredients: z.array(z.object({ name: z.string().min(1), amount: z.string().default("") })),
  steps: z.array(z.string()).min(1),
  macrosPerServing: macrosSchema,
});

export const menuDaySchema = z.object({
  dayLabel: z.string().min(1),
  meals: z.array(menuMealSchema).min(1).max(6),
});

// One line of the consolidated shopping list. "store" flags whether it's a
// normal-supermarket item or a specialty/ethnic-store item (e.g. buckwheat).
export const shoppingItemSchema = z.object({
  name: z.string().min(1),
  amount: z.string().default(""),
  category: ingredientCategoryEnum,
  store: z.enum(["mainstream", "specialty"]).default("mainstream"),
  note: z.string().default(""),
  // true = the user already has this (from their pantry photo/list), so it goes
  // to "Already have" instead of the buy list.
  have: z.boolean().default(false),
});

export const menuResultSchema = z.object({
  title: z.string().min(1),
  servingsPerMeal: z.number().int().min(1).max(12),
  days: z.array(menuDaySchema).min(1).max(7),
  shoppingList: z.array(shoppingItemSchema),
  notes: z.array(z.string()).default([]),
  // Gentle, non-pushy ideas for next week's shop, informed by what was on hand
  // (e.g. "you had lots of potatoes — here are ways to use them up", or a small
  // "try X" nudge). A few friendly lines, optional.
  nextWeekSuggestions: z.array(z.string()).default([]),
});
export type MenuResult = z.infer<typeof menuResultSchema>;

export const menuTargetsSchema = z.object({
  eaters: z.number().int(),
  perPersonCalories: z.number().int(),
  householdCalories: z.number().int(),
  proteinG: z.number(),
  fatG: z.number(),
  carbG: z.number(),
});
export type MenuTargets = z.infer<typeof menuTargetsSchema>;

// The week is generated in two calls so each fits the 60s function limit:
//  - "days1": produce days 1-4 (meals only)
//  - "final": given days 1-4, produce days 5-7 + the whole-week shopping list.
export const menuDaysOnlySchema = z.object({
  days: z.array(menuDaySchema).min(1).max(4),
});
export type MenuDaysOnly = z.infer<typeof menuDaysOnlySchema>;

export const menuRequestSchema = z.object({
  note: z.string().max(500).default(""),
  // Ingredients the user already has on hand (from a fridge/pantry photo or
  // typed in). The menu is built to use these first.
  pantry: z.array(z.object({ name: z.string().min(1) })).max(100).default([]),
  part: z.enum(["days1", "final"]).default("final"),
  // Days already generated in the first call (sent back on the "final" call).
  priorDays: z.array(menuDaySchema).max(4).default([]),
});
export type MenuRequest = z.infer<typeof menuRequestSchema>;
