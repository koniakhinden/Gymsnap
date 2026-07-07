import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { db } from "@/lib/db";
import { quickWorkouts } from "@/lib/db/schema";
import { getAnthropicClient, CLAUDE_MODEL, ClaudeError } from "@/lib/anthropic";
import {
  quickWorkoutSchema,
  quickWorkoutRequestSchema,
  type QuickWorkout,
  type QuickEquipmentItem,
} from "@/lib/validation/quick-workout";
import { getLatestProfile, getLatestGymWithEquipment } from "@/lib/plan-data";
import { getEligibleExercises, formatExerciseCompactList } from "@/lib/exercises";
import {
  buildQuickSystemPrompt,
  buildQuickUserMessage,
} from "@/lib/quick-workout-prompt";
import {
  getRecentQuickWorkouts,
  hydrateQuickWorkout,
} from "@/lib/quick-workout-data";

export const runtime = "nodejs";
// A single Claude generation call; give it room like the weekly plan route.
export const maxDuration = 60;
const MAX_TOKENS = 8000;

const quickTool: Anthropic.Tool = {
  name: "report_quick_workout",
  description: "Report the single-session workout.",
  input_schema: zodToJsonSchema(quickWorkoutSchema, {
    $refStrategy: "none",
  }) as Anthropic.Tool.InputSchema,
};

async function requestWorkoutFromClaude(
  system: string,
  userMessage: string,
  correctionMessage?: string
): Promise<QuickWorkout> {
  const anthropic = getAnthropicClient();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  if (correctionMessage) {
    messages.push({ role: "assistant", content: "(previous tool call omitted)" });
    messages.push({ role: "user", content: correctionMessage });
  }

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages,
    tools: [quickTool],
    tool_choice: { type: "tool", name: quickTool.name },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new ClaudeError("Claude did not return a tool call.");
  return quickWorkoutSchema.parse(toolUse.input);
}

function findInvalidExerciseIds(workout: QuickWorkout, validIds: Set<string>): string[] {
  const invalid = new Set<string>();
  for (const block of workout.blocks) {
    if (block.exerciseId && !validIds.has(block.exerciseId)) {
      invalid.add(block.exerciseId);
    }
  }
  return [...invalid];
}

// Same fallback as the weekly plan: an id Claude invented (or one not available
// with the user's equipment) becomes a null id + a nameOverride so the client
// still shows the movement, just without library images.
function dropInvalidIds(workout: QuickWorkout, validIds: Set<string>): QuickWorkout {
  return {
    ...workout,
    blocks: workout.blocks.map((b) => {
      if (b.exerciseId && !validIds.has(b.exerciseId)) {
        return {
          ...b,
          nameOverride: b.nameOverride ?? `Movement (${b.exerciseId})`,
          exerciseId: null,
        };
      }
      return b;
    }),
  };
}

async function generateWithValidation(
  system: string,
  userMessage: string,
  validIds: Set<string>
): Promise<QuickWorkout> {
  let workout = await requestWorkoutFromClaude(system, userMessage);
  let invalid = findInvalidExerciseIds(workout, validIds);

  if (invalid.length > 0) {
    const correction = `Your previous workout referenced exerciseId(s) that don't exist in the valid exercise library or aren't available with the user's equipment: ${invalid.join(
      ", "
    )}. Re-generate the full workout using only ids from the provided library, or set exerciseId to null with a nameOverride and clear instructions.`;
    workout = await requestWorkoutFromClaude(system, userMessage, correction);
    invalid = findInvalidExerciseIds(workout, validIds);
  }

  if (invalid.length > 0) {
    workout = dropInvalidIds(workout, validIds);
  }
  return workout;
}

export async function GET() {
  const history = await getRecentQuickWorkouts(5);
  return NextResponse.json({ history });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = quickWorkoutRequestSchema.parse(body);

    // Resolve which equipment the session may use.
    let equipmentItems: QuickEquipmentItem[] = [];
    if (parsed.equipmentMode === "saved") {
      const gymData = await getLatestGymWithEquipment();
      if (!gymData || gymData.items.length === 0) {
        return NextResponse.json(
          { error: "No saved gym found. Add equipment in Gym setup, or pick another option." },
          { status: 400 }
        );
      }
      equipmentItems = gymData.items.map((i) => ({ name: i.name, category: i.category }));
    } else if (parsed.equipmentMode === "photo") {
      equipmentItems = parsed.equipmentItems;
    } // "none" → bodyweight only, equipmentItems stays []

    const eligible = await getEligibleExercises(
      equipmentItems.map((i) => ({ name: i.name, category: i.category }))
    );
    const validIds = new Set(eligible.map((e) => e.id));
    const compactList = formatExerciseCompactList(eligible);

    const profile = await getLatestProfile();

    const system = buildQuickSystemPrompt();
    const userMessage = buildQuickUserMessage({
      mode: parsed.equipmentMode,
      items: equipmentItems,
      chips: parsed.focusChips,
      text: parsed.focusText,
      timeMin: parsed.timeMin,
      profile,
      compactList,
    });

    const workout = await generateWithValidation(system, userMessage, validIds);

    const now = new Date().toISOString();
    const [row] = await db
      .insert(quickWorkouts)
      .values({
        equipmentMode: parsed.equipmentMode,
        equipment: equipmentItems,
        focusChips: parsed.focusChips,
        focusText: parsed.focusText,
        timeMin: parsed.timeMin,
        result: workout,
        createdAt: now,
      })
      .returning();

    const hydrated = await hydrateQuickWorkout(workout);
    return NextResponse.json({ id: row.id, workout: hydrated });
  } catch (err) {
    console.error("quick-workout generate error:", err);
    // TODO(beta): surfacing raw error details to the client for debugging.
    // Replace with a generic message before public launch.
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const message =
      err instanceof ClaudeError ? err.message : `Failed to build the workout — ${detail}`;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
