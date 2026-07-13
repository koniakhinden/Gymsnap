import { z } from "zod";

export const mealLogSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD"),
  name: z.string().min(1).max(120),
  calories: z.number().int().min(0).max(5000).default(0),
  proteinG: z.number().min(0).max(400).default(0),
  fatG: z.number().min(0).max(400).default(0),
  carbG: z.number().min(0).max(600).default(0),
});
export type MealLogInput = z.infer<typeof mealLogSchema>;

// A meal recognized from a photo (the dish itself or a nutrition label).
export const recognizedMealSchema = z.object({
  name: z.string().min(1).max(120),
  calories: z.number().int().min(0).max(5000),
  proteinG: z.number().min(0).max(400),
  fatG: z.number().min(0).max(400),
  carbG: z.number().min(0).max(600),
  // e.g. "read from label, per 1 bar" or "estimated for a medium portion".
  note: z.string().default(""),
});
export type RecognizedMeal = z.infer<typeof recognizedMealSchema>;
