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
});

export const menuResultSchema = z.object({
  title: z.string().min(1),
  servingsPerMeal: z.number().int().min(1).max(12),
  days: z.array(menuDaySchema).min(1).max(7),
  shoppingList: z.array(shoppingItemSchema),
  notes: z.array(z.string()).default([]),
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

export const menuRequestSchema = z.object({
  note: z.string().max(500).default(""),
});
