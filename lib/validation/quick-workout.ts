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

// What kind of session the user wants right now.
//  - strength: resistance work (the original behaviour, kept as default)
//  - cardio:   conditioning only (steady state or intervals), no lifting
//  - mixed:    a short strength block plus a cardio finisher
export const sessionTypeEnum = z.enum(["strength", "cardio", "mixed"]);
export type SessionType = z.infer<typeof sessionTypeEnum>;

export const quickWorkoutSchema = z.object({
  title: z.string().min(1),
  focus: z.string().min(1),
  // Echoed back by the model so history can re-run the same kind of session.
  // Optional + default keeps older stored workouts (no field) valid.
  sessionType: sessionTypeEnum.default("strength"),
  totalMin: z.number().int().min(1).max(120),
  warmup: z.array(quickSegmentSchema),
  // Cardio-only sessions describe their work in the cardio segments below, so
  // blocks may be empty; strength/mixed sessions still need at least one block.
  blocks: z.array(quickBlockSchema),
  // Cardio pieces: intervals or steady-state efforts (empty for pure strength).
  cardio: z.array(quickSegmentSchema).default([]),
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
  details: z.string().nullish(),
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
  // Strength (default), cardio-only, or a mixed session.
  sessionType: sessionTypeEnum.default("strength"),
  focusChips: z.array(z.string()).default([]),
  focusText: z.string().default(""),
  timeMin: quickTimeEnum,
});

export type QuickEquipmentItem = z.infer<typeof quickEquipmentItemSchema>;
export type QuickWorkoutRequest = z.infer<typeof quickWorkoutRequestSchema>;
