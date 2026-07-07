import { z } from "zod";

export const dayCheckinInputSchema = z.object({
  dayId: z.number().int(),
  status: z.enum(["completed", "partial", "skipped"]),
});

export const checkinInputSchema = z.object({
  weekId: z.number().int(),
  overallComment: z.string().default(""),
  wellbeing: z.number().int().min(1).max(5),
  kneesRating: z.number().int().min(1).max(5),
  lowerBackRating: z.number().int().min(1).max(5),
  days: z.array(dayCheckinInputSchema).min(1),
});

export type CheckinInput = z.infer<typeof checkinInputSchema>;
