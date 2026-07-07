import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { zodToJsonSchema } from "zod-to-json-schema";
import Anthropic from "@anthropic-ai/sdk";
import { callClaudeForTool, ClaudeError } from "@/lib/anthropic";
import {
  recognizeEquipmentResponseSchema,
  type RecognizeEquipmentResponse,
} from "@/lib/validation/equipment";

export const MAX_FILES = 10;
export const MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

// "gym" — full commercial/home gym: many machines per photo, mirrors, weight stacks.
// "quick" — a "what do I have right now?" snapshot: often sparse (one band on the
// floor, a couple of dumbbells, a mat, an outdoor pull-up bar, an empty hotel room).
export type RecognitionMode = "gym" | "quick";

const GYM_PROMPT = `You are a gym equipment recognition assistant for a fitness app called GymSnap.
You will be shown 1-10 photos of the same home or commercial gym, taken from different angles.

Your job: extract a single, de-duplicated list of the exercise equipment visible across ALL photos combined.

Critical rules:
- A single photo will often show SEVERAL machines and items at once (a whole corner or wall of the gym). Carefully scan each photo edge to edge and list EVERY distinct piece of equipment visible, including ones in the background — do not stop at the most prominent machine.
- The photos may include mirrors or a mirrored wall. Equipment reflected in a mirror is the SAME physical equipment you may see directly in another photo (or the same photo) — do NOT count or list mirror reflections as separate items. Use context (room layout, duplicate angles) to figure out what is a reflection versus a distinct second unit.
- Completely ignore any people/bodies in the photos — never list them as equipment.
- If you can read numbers on dumbbells, a weight stack, or plates, report the visible weight range in the "details" field (e.g. "5-50 lbs dumbbells in 5 lb increments" or "stack up to 200 lbs"). If you cannot read exact numbers, describe what you can see instead.
- Classify each item into exactly one category: "cardio" (treadmill, bike, elliptical, rower, etc.), "strength_machine" (cable machine, leg press, lat pulldown, smith machine, etc.), "free_weights" (dumbbells, barbells, kettlebells, plates), or "accessories" (bench, mat, resistance bands, pull-up bar, foam roller, medicine ball, etc.).
- Set "confidence" to "low" whenever the equipment is partially obscured, far away, blurry, or you are guessing at specs — the app will flag these for the user to double check.
- Keep "name" short and specific (e.g. "Adjustable dumbbell rack", "Cable crossover machine", "Flat bench").
- Only report equipment actually visible in the photos. Do not invent equipment that isn't shown.

Respond only by calling the report_equipment tool.`;

const QUICK_PROMPT = `You are an equipment recognition assistant for GymSnap's "Train now" feature.
You will be shown 1-10 photos of whatever the user has available RIGHT NOW to train with. This is usually NOT a full gym — expect sparse, everyday scenes.

Your job: extract a single, de-duplicated list of anything in the photos that could be used for a workout.

Critical rules:
- Scenes are often minimal. A single resistance band on the floor, a pair of dumbbells in a living room, a yoga mat, a chair, a filled water bottle used as a weight, a park pull-up bar or monkey bars, a sturdy table, stairs, or a doorway pull-up bar are all valid items — list them.
- If a photo shows an essentially empty room (a hotel room, a bare bedroom) with no usable equipment, return an empty items list rather than inventing anything. The app will fall back to a bodyweight workout.
- Do NOT invent equipment that isn't clearly visible. It is fine and expected to return only 1-2 items, or none.
- Ignore any people/bodies in the photos — never list them as equipment.
- If you can read weights on dumbbells/kettlebells/plates or a band's resistance level, put it in the "details" field. Otherwise describe what you see.
- Classify each item into exactly one category: "cardio" (jump rope, bike, treadmill, etc.), "strength_machine" (any weight machine), "free_weights" (dumbbells, kettlebells, barbells, plates, or improvised weights like water bottles/backpacks), or "accessories" (resistance bands, yoga mat, pull-up bar, chair, bench, box, foam roller, etc.).
- Set "confidence" to "low" when an item is partially visible, far away, blurry, or improvised.
- Keep "name" short and specific (e.g. "Light resistance band", "Pair of 10 kg dumbbells", "Yoga mat", "Outdoor pull-up bar").

Respond only by calling the report_equipment tool.`;

const equipmentTool: Anthropic.Tool = {
  name: "report_equipment",
  description: "Report the de-duplicated list of equipment recognized across the photos.",
  input_schema: zodToJsonSchema(recognizeEquipmentResponseSchema, {
    $refStrategy: "none",
  }) as Anthropic.Tool.InputSchema,
};

// Claude vision downscales anything above ~1568px on the long side anyway,
// so resizing + recompressing here loses no recognition quality but keeps
// the total request far below the API size limit (fixes 413 request_too_large).
// The same compressed buffer is what gets uploaded to Vercel Blob, so we never
// store multi-megabyte originals.
async function compressImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate() // respect EXIF orientation before stripping metadata
      .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch {
    if (mimeType === "image/heic" || mimeType === "image/heif") {
      throw new ClaudeError(
        "This environment can't convert HEIC photos. Please export them as JPEG or PNG and try again."
      );
    }
    throw new ClaudeError(
      "Couldn't process one of the photos. Please re-export it as JPEG and try again."
    );
  }
}

function toClaudeImageBlock(compressedJpeg: Buffer): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: compressedJpeg.toString("base64"),
    },
  };
}

/** Validates the uploaded files, returning an error message or null. */
export function validateUploadedFiles(files: File[]): string | null {
  if (files.length === 0) return "Upload at least one photo.";
  if (files.length > MAX_FILES) return `Upload at most ${MAX_FILES} photos.`;
  for (const file of files) {
    if (!ACCEPTED_TYPES.has(file.type)) {
      return `Unsupported file type: ${file.type || file.name}. Use JPEG, PNG, or HEIC.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `${file.name} is larger than 10 MB.`;
    }
  }
  return null;
}

/**
 * Shared pipeline: compress each photo, upload to Vercel Blob, and ask Claude
 * to extract a de-duplicated equipment list. `mode` swaps the recognition prompt
 * between a full-gym scan and a sparse "what do I have right now" scan.
 */
export async function recognizeEquipmentFromFiles(
  files: File[],
  mode: RecognitionMode
): Promise<RecognizeEquipmentResponse & { photoUrls: string[] }> {
  const photoUrls: string[] = [];
  const imageBlocks: Anthropic.ImageBlockParam[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImage(buffer, file.type);

    const blob = await put(`gym-photos/${randomUUID()}.jpg`, compressed, {
      access: "public",
      contentType: "image/jpeg",
    });
    photoUrls.push(blob.url);
    imageBlocks.push(toClaudeImageBlock(compressed));
  }

  const promptTail =
    mode === "quick"
      ? "Here are photos of what I have to train with right now. Extract the equipment list as instructed."
      : "Here are the gym photos. Extract the de-duplicated equipment list as instructed.";

  const content: Anthropic.ContentBlockParam[] = [
    ...imageBlocks,
    { type: "text", text: promptTail },
  ];

  const result = await callClaudeForTool<RecognizeEquipmentResponse>({
    system: mode === "quick" ? QUICK_PROMPT : GYM_PROMPT,
    messages: [{ role: "user", content }],
    tool: equipmentTool,
    maxTokens: 4096,
    validate: (input) => recognizeEquipmentResponseSchema.parse(input),
  });

  return { items: result.items, photoUrls };
}
