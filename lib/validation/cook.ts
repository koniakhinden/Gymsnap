import { z } from "zod";

export const ingredientCategoryEnum = z.enum([
  "produce",
  "protein",
  "dairy",
  "grain",
  "pantry",
  "condiment",
  "frozen",
  "bakery",
  "beverage",
  "other",
]);
export const confidenceEnum = z.enum(["high", "medium", "low"]);

// ---- Recognition (fridge/pantry photo → ingredients) ----
export const recognizedIngredientSchema = z.object({
  name: z.string().min(1),
  category: ingredientCategoryEnum,
  quantity: z.string().default(""),
  confidence: confidenceEnum,
});
export const recognizeIngredientsResponseSchema = z.object({
  items: z.array(recognizedIngredientSchema),
});
export type RecognizedIngredient = z.infer<typeof recognizedIngredientSchema>;
export type RecognizeIngredientsResponse = z.infer<typeof recognizeIngredientsResponseSchema>;

// ---- Recipe result ("cook now") ----
export const recipeIngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.string().default(""),
});
export const macrosSchema = z.object({
  calories: z.number().int().min(0).max(3000),
  proteinG: z.number().min(0).max(300),
  fatG: z.number().min(0).max(300),
  carbG: z.number().min(0).max(500),
});
export const recipeSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  servings: z.number().int().min(1).max(12),
  timeMin: z.number().int().min(1).max(240),
  // Ingredients you already have that this recipe uses.
  ingredientsUsed: z.array(recipeIngredientSchema),
  // Small extra items to buy/grab (kept short — it's a "cook now" idea).
  missingItems: z.array(z.string()).default([]),
  steps: z.array(z.string()).min(1),
  macrosPerServing: macrosSchema,
});
export const cookResultSchema = z.object({
  title: z.string().min(1),
  recipes: z.array(recipeSchema).min(1).max(3),
  cautions: z.array(z.string()).default([]),
});
export type Recipe = z.infer<typeof recipeSchema>;
export type CookResult = z.infer<typeof cookResultSchema>;

// ---- Request (what /cook sends to generate) ----
export const cookSourceEnum = z.enum(["photo", "manual"]);
export const mealTypeEnum = z.enum(["any", "breakfast", "lunch", "dinner", "snack"]);
export const cookIngredientInputSchema = z.object({
  name: z.string().min(1),
  category: ingredientCategoryEnum.optional(),
});
export const cookRequestSchema = z.object({
  source: cookSourceEnum,
  ingredients: z.array(cookIngredientInputSchema).default([]),
  mealType: mealTypeEnum.default("any"),
  servings: z.number().int().min(1).max(12).default(1),
  note: z.string().max(500).default(""),
});
export type CookRequest = z.infer<typeof cookRequestSchema>;
export type CookIngredientInput = z.infer<typeof cookIngredientInputSchema>;
