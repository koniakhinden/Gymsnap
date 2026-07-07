import { z } from "zod";

export const equipmentCategoryEnum = z.enum([
  "cardio",
  "strength_machine",
  "free_weights",
  "accessories",
]);

export const confidenceEnum = z.enum(["high", "medium", "low"]);

export const recognizedEquipmentItemSchema = z.object({
  name: z.string().min(1),
  category: equipmentCategoryEnum,
  details: z.string().default(""),
  confidence: confidenceEnum,
});

export const recognizeEquipmentResponseSchema = z.object({
  items: z.array(recognizedEquipmentItemSchema),
});

export type RecognizedEquipmentItem = z.infer<typeof recognizedEquipmentItemSchema>;
export type RecognizeEquipmentResponse = z.infer<typeof recognizeEquipmentResponseSchema>;

export const confirmEquipmentItemSchema = z.object({
  name: z.string().min(1),
  category: equipmentCategoryEnum,
  details: z.string().default(""),
  confidence: confidenceEnum,
  source: z.enum(["recognized", "manual"]),
});

export const confirmEquipmentRequestSchema = z.object({
  items: z.array(confirmEquipmentItemSchema).min(1),
  photoUrls: z.array(z.string()).default([]),
});

export type ConfirmEquipmentItem = z.infer<typeof confirmEquipmentItemSchema>;
