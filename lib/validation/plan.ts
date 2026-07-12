import { z } from "zod";

// A backup exercise for when the primary station/equipment is occupied. Same
// movement pattern, ideally different equipment. Mirrors the main exercise's
// exerciseId/nameOverride split so it can be hydrated with library images.
export const planAlternativeSchema = z.object({
  exerciseId: z.string().nullable(),
  nameOverride: z.string().nullable(),
  // One short line on why it substitutes (e.g. "No bench — floor press").
  note: z.string().default(""),
});

// A single move in a warmup or stretch routine. Like exercises it can point at a
// library id (for an image + instructions) or be a described movement. "howTo"
// and "duration" carry the guidance when there is no library id.
export const routineItemSchema = z.object({
  exerciseId: z.string().nullable(),
  nameOverride: z.string().nullable(),
  howTo: z.string().default(""),
  duration: z.string().default(""),
});

// A weekly stretching block, targeting the muscles trained that week. Optional —
// never counts toward day/week completion.
export const stretchBlockSchema = z.object({
  title: z.string().min(1),
  targetMuscles: z.array(z.string()).default([]),
  items: z.array(routineItemSchema).min(1).max(4),
});

export const planExerciseSchema = z.object({
  exerciseId: z.string().nullable(),
  nameOverride: z.string().nullable(),
  sets: z.number().int().min(1).max(10),
  reps: z.string().min(1),
  weight: z.string().default(""),
  restSec: z.number().int().min(0).max(600),
  notes: z.string().default(""),
  // Up to 3 fallbacks shown behind a button (never printed to PDF).
  alternatives: z.array(planAlternativeSchema).max(3).default([]),
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
  // Structured warmup (3-5 dynamic/mobility moves). "warmup" text is kept as a
  // short summary / fallback and for the PDF.
  warmupItems: z.array(routineItemSchema).max(6).default([]),
  exercises: z.array(planExerciseSchema),
  cooldown: z.string().default(""),
  cardio: planCardioSchema,
});

export const weekPlanSchema = z.object({
  week: z.number().int().min(1),
  days: z.array(planDaySchema).min(1),
  // 2-3 optional static-stretch blocks for the week, grouped by muscle groups.
  stretchBlocks: z.array(stretchBlockSchema).max(3).default([]),
});

export type PlanAlternative = z.infer<typeof planAlternativeSchema>;
export type RoutineItem = z.infer<typeof routineItemSchema>;
export type StretchBlock = z.infer<typeof stretchBlockSchema>;
export type PlanExercise = z.infer<typeof planExerciseSchema>;
export type PlanDay = z.infer<typeof planDaySchema>;
export type WeekPlan = z.infer<typeof weekPlanSchema>;
