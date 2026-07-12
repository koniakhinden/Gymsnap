import { z } from "zod";

export const sexEnum = z.enum(["male", "female", "other"]);
export const activityEnum = z.enum([
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]);
export const nutritionGoalEnum = z.enum(["lose", "maintain", "gain"]);
export const budgetEnum = z.enum(["low", "medium", "high"]);

// One eater (self or family member). Bounds keep the calorie engine sane and
// block nonsensical / unsafe inputs.
export const eaterSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().max(60).default(""),
  isSelf: z.boolean().default(false),
  sex: sexEnum,
  ageYears: z.number().int().min(13).max(100),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300),
  activity: activityEnum,
  goal: nutritionGoalEnum,
  dietary: z.array(z.string().max(40)).max(20).default([]),
  allergies: z.array(z.string().max(40)).max(30).default([]),
});

export const saveEatersSchema = z.object({
  eaters: z.array(eaterSchema).min(1).max(8),
});

export const nutritionSettingsSchema = z.object({
  country: z.string().max(60).default(""),
  region: z.string().max(60).default(""),
  city: z.string().max(60).default(""),
  cuisines: z.array(z.string().max(40)).max(20).default([]),
  likes: z.array(z.string().max(40)).max(50).default([]),
  dislikes: z.array(z.string().max(40)).max(50).default([]),
  budgetLevel: budgetEnum.nullish(),
  calorieTargetOverride: z.number().int().min(1000).max(6000).nullish(),
});

export type EaterInputDTO = z.infer<typeof eaterSchema>;
export type NutritionSettingsDTO = z.infer<typeof nutritionSettingsSchema>;
