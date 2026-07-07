import { z } from "zod";
import { equipmentCategoryEnum } from "./equipment";

// A warmup/cooldown movement — always plain text (never a library exercise id),
// because mobility/activation drills mostly live outside the exercise library.
export const quickSegmentSchema = z.object({
  name: z.string().min(1),
  howTo: z.string().min(1),
  durationOrReps: z.string().min(1),
});

// A main working block. Mirrors the weekly plan's exerciseId/nameOverride split:
// a library id when one fits, otherwise null + a described movement.
export const quickBlockSchema = z.object({
  exerciseId: z.string().nullable(),
  nameOverride: z.string().nullable(),
  sets: z.number().int().min(1).max(10),
  reps: z.string().min(1),
  weightOrBand: z.string().nullable().default(null),
  restSec: z.number().int().min(0).max(600),
  whyIncluded: z.string().default(""),
  easierOption: z.string().default(""),
  harderOption: z.string().default(""),
});

export const quickWorkoutSchema = z.object({
  title: z.string().min(1),
  focus: z.string().min(1),
  totalMin: z.number().int().min(1).max(120),
  warmup: z.array(quickSegmentSchema),
  blocks: z.array(quickBlockSchema).min(1),
  cooldown: z.array(quickSegmentSchema),
  cautions: z.array(z.string()).default([]),
});

export type QuickBlock = z.infer<typeof quickBlockSchema>;
export type QuickSegment = z.infer<typeof quickSegmentSchema>;
export type QuickWorkout = z.infer<typeof quickWorkoutSchema>;

// ---- Request (what the /quick screen sends to generate) ----

export const quickEquipmentModeEnum = z.enum(["saved", "photo", "none"]);

export const quickEquipmentItemSchema = z.object({
  name: z.string().min(1),
  category: equipmentCategoryEnum,
});

export const quickTimeEnum = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(30),
  z.literal(45),
]);

export const quickWorkoutRequestSchema = z.object({
  equipmentMode: quickEquipmentModeEnum,
  // Only used when equipmentMode === "photo"; ignored for "saved" (loaded from
  // the DB) and "none" (bodyweight only).
  equipmentItems: z.array(quickEquipmentItemSchema).default([]),
  focusChips: z.array(z.string()).default([]),
  focusText: z.string().default(""),
  timeMin: quickTimeEnum,
});

export type QuickEquipmentItem = z.infer<typeof quickEquipmentItemSchema>;
export type QuickWorkoutRequest = z.infer<typeof quickWorkoutRequestSchema>;
