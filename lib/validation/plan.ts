import { z } from "zod";

export const planExerciseSchema = z.object({
  exerciseId: z.string().nullable(),
  nameOverride: z.string().nullable(),
  sets: z.number().int().min(1).max(10),
  reps: z.string().min(1),
  weight: z.string().default(""),
  restSec: z.number().int().min(0).max(600),
  notes: z.string().default(""),
});

export const planCardioSchema = z
  .object({
    type: z.string(),
    durationMin: z.number().int().min(1).max(120),
    incline: z.string().nullable().default(null),
    targetHr: z.string().nullable().default(null),
  })
  .nullable();

export const planDaySchema = z.object({
  dayLabel: z.string().min(1),
  focus: z.string().min(1),
  warmup: z.string().default(""),
  exercises: z.array(planExerciseSchema),
  cooldown: z.string().default(""),
  cardio: planCardioSchema,
});

export const weekPlanSchema = z.object({
  week: z.number().int().min(1),
  days: z.array(planDaySchema).min(1),
});

export type PlanExercise = z.infer<typeof planExerciseSchema>;
export type PlanDay = z.infer<typeof planDaySchema>;
export type WeekPlan = z.infer<typeof weekPlanSchema>;
