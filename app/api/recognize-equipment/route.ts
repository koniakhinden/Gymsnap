import { NextRequest, NextResponse } from "next/server";
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

export const runtime = "nodejs";
// Claude vision on multiple photos takes 20-60s; the default function
// duration limit cuts the request off before it finishes.
export const maxDuration = 60;

const MAX_FILES = 10;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);

const SYSTEM_PROMPT = `You are a gym equipment recognition assistant for a fitness app called GymSnap.
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

const equipmentTool: Anthropic.Tool = {
  name: "report_equipment",
  description: "Report the de-duplicated list of gym equipment recognized across the photos.",
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
    throw new ClaudeError("Couldn't process one of the photos. Please re-export it as JPEG and try again.");
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("photos").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "Upload at least one photo." }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Upload at most ${MAX_FILES} photos.` },
        { status: 400 }
      );
    }
    for (const file of files) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type || file.name}. Use JPEG, PNG, or HEIC.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_SIZE_BYTES) {
        return NextResponse.json(
          { error: `${file.name} is larger than 10 MB.` },
          { status: 400 }
        );
      }
    }

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

    const content: Anthropic.ContentBlockParam[] = [
      ...imageBlocks,
      {
        type: "text",
        text: "Here are the gym photos. Extract the de-duplicated equipment list as instructed.",
      },
    ];

    const result = await callClaudeForTool<RecognizeEquipmentResponse>({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      tool: equipmentTool,
      maxTokens: 4096,
      validate: (input) => recognizeEquipmentResponseSchema.parse(input),
    });

    return NextResponse.json({ items: result.items, photoUrls });
  } catch (err) {
    const message = err instanceof ClaudeError ? err.message : "Recognition failed. Please try again.";
    console.error("recognize-equipment error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
