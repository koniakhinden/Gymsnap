import { z } from "zod";

export const profileInputSchema = z.object({
  ageGroup: z.enum(["25-34", "35-44", "45-54", "55+"]),
  bodyWeight: z.number().positive(),
  weightUnit: z.enum(["kg", "lbs"]),
  sex: z.enum(["male", "female", "other"]),
  experience: z.enum(["beginner", "intermediate", "advanced", "returning"]),
  goal: z.enum(["weight_loss", "muscle_gain", "strength", "general_fitness"]),
  daysPerWeek: z.number().int().min(2).max(6),
  sessionLength: z.enum(["30-40", "45-60", "60-90"]),
  injuriesText: z.string().default(""),
  injuryKnees: z.boolean().default(false),
  injuryLowerBack: z.boolean().default(false),
  injuryShoulders: z.boolean().default(false),
  cardioIncline: z.boolean().default(false),
  cardioRunning: z.boolean().default(false),
  cardioBike: z.boolean().default(false),
  cardioElliptical: z.boolean().default(false),
  cardioMinimal: z.boolean().default(false),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
