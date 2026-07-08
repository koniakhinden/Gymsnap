import { z } from "zod";

export const setLogInputSchema = z.object({
  setNumber: z.number().int().min(1).max(20),
  // null weight = bodyweight / not recorded
  weight: z.number().min(0).max(2000).nullable(),
  // null reps = "to failure" without a recorded count
  reps: z.number().int().min(1).max(100).nullable(),
  toFailure: z.boolean().default(false),
});

export const logSaveSchema = z.object({
  entryId: z.number().int(),
  weightUnit: z.enum(["kg", "lbs"]),
  // The client's own timestamp, so the recorded instant matches the user's
  // device clock/timezone. Falls back to server time if absent.
  loggedAt: z.string().datetime().optional(),
  sets: z.array(setLogInputSchema).min(1).max(20),
});

export type LogSaveInput = z.infer<typeof logSaveSchema>;
export type SetLogInput = z.infer<typeof setLogInputSchema>;
