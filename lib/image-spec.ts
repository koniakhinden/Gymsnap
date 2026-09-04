// Spec generation: turning an exercise row into drawing instructions via Claude.
//
// Shared by the CLI (scripts/images.ts) and the workbench API, for the same
// reason as lib/image-generation.ts — one copy of the schema and the system
// prompt, so the two can't drift into producing differently-shaped specs.

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { db } from "./db";
import { exerciseImageSpecs, exercises } from "./db/schema";
import { figureFor, TEMPLATE_VERSION } from "./image-prompt";
import { withRetry } from "./image-generation";

export const SPEC_MODEL = "claude-sonnet-5";

export const SpecSchema = z.object({
  phases: z
    .number()
    .int()
    .min(2)
    .max(4)
    .describe("Number of distinct positions worth drawing. Most lifts need 2."),
  camera: z
    .enum(["profile", "front", "three_quarter"])
    .describe(
      "profile by default; front for lateral raises, abductions and other movements " +
        "invisible from the side; three_quarter when grip or stance width is the point " +
        "of the exercise and the far hand would be hidden in profile.",
    ),
  orientation: z
    .enum(["upright", "horizontal"])
    .describe(
      "upright when the torso is vertical (squats, standing presses, seated rows); " +
        "horizontal when the body lies down or holds a horizontal plank (bench press, " +
        "inverted row, push-up, plank, crunch). Picks the canvas aspect ratio.",
    ),
  panelDescriptions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "One entry per phase, in order. Each describes joint angles, spine position, " +
        "and where the load sits. Present tense, no sentence about style or camera.",
    ),
});

export const SPEC_SYSTEM = `You convert exercise data into drawing instructions for an instructional
illustration. You never describe style, colour, background or camera framing — those are
fixed elsewhere. You describe only the body and the load.

Rules:
- Each panel must be an unambiguous position, not a movement. "Lowering the bar" is wrong;
  "bar touching the chest, elbows at 45 degrees" is right.
- State joint angles and depth explicitly where form matters (hip below knee, elbows tucked).
- Keep every panel comparable: same stance, same grip, only the moving parts differ.
- Mention the equipment concretely enough to draw it, including plate count where relevant.
- 2 phases for almost everything. Use 3-4 only for genuinely multi-position movements
  (burpee, clean, turkish get-up).
- Orientation describes the TORSO, not the limbs: "upright" for squats, standing presses,
  seated rows and anything performed on the feet or seated upright; "horizontal" for bench
  press, push-ups, planks, crunches, inverted rows and anything lying or held in a
  horizontal plank.`;

export type ExerciseForSpec = {
  id: string;
  name: string;
  equipment: string | null;
  force: string | null;
  mechanic: string | null;
  primaryMuscles: string[];
  instructions: string[];
};

export type Spec = z.infer<typeof SpecSchema>;

/**
 * Ask Claude for one exercise's drawing spec and store it.
 *
 * Validation lives INSIDE withRetry: the model occasionally emits
 * panelDescriptions as a string instead of an array, or a panel count that
 * disagrees with `phases`. Those are transient bad draws, not permanent
 * failures — retrying gets a usable spec, whereas parsing outside the retry
 * dropped the exercise from the run for good.
 */
export async function generateSpec(ex: ExerciseForSpec): Promise<Spec> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const spec = await withRetry(async () => {
    const res = await anthropic.messages.create({
      model: SPEC_MODEL,
      max_tokens: 1500,
      system: SPEC_SYSTEM,
      tools: [
        {
          name: "emit_spec",
          description: "Emit drawing instructions for this exercise.",
          input_schema: zodToJsonSchema(SpecSchema) as never,
        },
      ],
      tool_choice: { type: "tool", name: "emit_spec" },
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            name: ex.name,
            equipment: ex.equipment,
            force: ex.force,
            mechanic: ex.mechanic,
            primaryMuscles: ex.primaryMuscles,
            instructions: ex.instructions,
          }),
        },
      ],
    });

    const block = res.content.find((c) => c.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("no tool_use");
    const parsed = SpecSchema.parse(block.input);
    if (parsed.panelDescriptions.length !== parsed.phases) {
      throw new Error(`phases=${parsed.phases}, но панелей ${parsed.panelDescriptions.length}`);
    }
    return parsed;
  });

  await db
    .insert(exerciseImageSpecs)
    .values({
      exerciseId: ex.id,
      phases: spec.phases,
      camera: spec.camera,
      orientation: spec.orientation,
      panelDescriptions: spec.panelDescriptions,
      figure: figureFor(ex.id),
      templateVersion: TEMPLATE_VERSION,
    })
    .onConflictDoUpdate({
      target: exerciseImageSpecs.exerciseId,
      // руками правленную спеку не трогаем
      setWhere: eq(exerciseImageSpecs.editedByHand, false),
      set: {
        phases: spec.phases,
        camera: spec.camera,
        orientation: spec.orientation,
        panelDescriptions: spec.panelDescriptions,
        templateVersion: TEMPLATE_VERSION,
        updatedAt: new Date(),
      },
    });

  return spec;
}

export const SPEC_COLUMNS = {
  id: exercises.id,
  name: exercises.name,
  equipment: exercises.equipment,
  force: exercises.force,
  mechanic: exercises.mechanic,
  primaryMuscles: exercises.primaryMuscles,
  instructions: exercises.instructions,
};
