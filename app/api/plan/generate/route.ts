import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Weekly plan generation is a long Claude call; don't let the default
// function duration limit cut it off.
export const maxDuration = 60;
import { zodToJsonSchema } from "zod-to-json-schema";
import { db } from "@/lib/db";
import { weeks, days, exerciseEntries } from "@/lib/db/schema";
import { getAnthropicClient, CLAUDE_MODEL, ClaudeError } from "@/lib/anthropic";
import { weekPlanSchema, type WeekPlan } from "@/lib/validation/plan";
import {
  getLatestProfile,
  getLatestGymWithEquipment,
  getAllWeeksHistoryForPrompt,
} from "@/lib/plan-data";
import { getEligibleExercises, formatExerciseCompactList } from "@/lib/exercises";
import {
  buildProfileSummary,
  buildEquipmentSummary,
  buildHistorySummary,
  buildPlanSystemPrompt,
} from "@/lib/plan-prompt";

export const runtime = "nodejs";
const MAX_TOKENS = 8000;

const planTool: Anthropic.Tool = {
  name: "report_week_plan",
  description: "Report the full week training plan.",
  input_schema: zodToJsonSchema(weekPlanSchema, { $refStrategy: "none" }) as Anthropic.Tool.InputSchema,
};

// Claude occasionally returns tool input with minor format defects: nested
// arrays serialized as JSON strings ("days": "[...]") or a missing "week".
// Repair what's mechanically fixable before Zod validation.
function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function repairPlanInput(raw: unknown, expectedWeek: number): unknown {
  const root = tryParseJson(raw);
  if (!root || typeof root !== "object" || Array.isArray(root)) return root;
  const obj: Record<string, unknown> = { ...(root as Record<string, unknown>) };

  obj.days = tryParseJson(obj.days);
  if (Array.isArray(obj.days)) {
    obj.days = obj.days.map((d) => {
      const day = tryParseJson(d);
      if (!day || typeof day !== "object" || Array.isArray(day)) return day;
      const dayObj: Record<string, unknown> = { ...(day as Record<string, unknown>) };
      dayObj.exercises = tryParseJson(dayObj.exercises);
      dayObj.cardio = tryParseJson(dayObj.cardio);
      return dayObj;
    });
  }

  if (obj.week === undefined || obj.week === null) {
    obj.week = expectedWeek;
  } else if (typeof obj.week === "string" && !Number.isNaN(Number(obj.week))) {
    obj.week = Number(obj.week);
  }
  return obj;
}

async function requestPlanFromClaude(
  system: string,
  userMessage: string,
  expectedWeek: number,
  correctionMessage?: string
): Promise<WeekPlan> {
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
    tools: [planTool],
    tool_choice: { type: "tool", name: planTool.name },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new ClaudeError("Claude did not return a tool call.");
  const parsed = weekPlanSchema.safeParse(repairPlanInput(toolUse.input, expectedWeek));
  if (!parsed.success) {
    throw new ClaudeError(`invalid plan format: ${parsed.error.message}`);
  }
  return parsed.data;
}

function findInvalidExerciseIds(plan: WeekPlan, validIds: Set<string>): string[] {
  const invalid = new Set<string>();
  for (const day of plan.days) {
    for (const ex of day.exercises) {
      if (ex.exerciseId && !validIds.has(ex.exerciseId)) {
        invalid.add(ex.exerciseId);
      }
    }
  }
  return [...invalid];
}

function markUnverified(plan: WeekPlan, validIds: Set<string>): WeekPlan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => {
        if (ex.exerciseId && !validIds.has(ex.exerciseId)) {
          return {
            ...ex,
            nameOverride: ex.nameOverride ?? `Unverified exercise (${ex.exerciseId})`,
            exerciseId: null,
          };
        }
        return ex;
      }),
    })),
  };
}

async function withRetryValidation(
  system: string,
  userMessage: string,
  validIds: Set<string>,
  expectedWeek: number
): Promise<{ plan: WeekPlan; hasUnverified: boolean }> {
  let plan: WeekPlan;
  try {
    plan = await requestPlanFromClaude(system, userMessage, expectedWeek);
  } catch (err) {
    // One retry when the model returned a malformed plan (schema mismatch).
    if (err instanceof ClaudeError && err.message.includes("invalid plan format")) {
      plan = await requestPlanFromClaude(
        system,
        userMessage,
        expectedWeek,
        `Your previous response did not match the tool input schema (${err.message}). Return the COMPLETE week plan again, strictly following the schema: "week" must be a number, "days" must be a JSON array of day objects (never a string), and every day's "exercises" must be an array of objects.`
      );
    } else {
      throw err;
    }
  }
  let invalid = findInvalidExerciseIds(plan, validIds);

  if (invalid.length > 0) {
    const correction = `Your previous plan referenced exerciseId(s) that don't exist in the valid exercise library or aren't available with the user's equipment: ${invalid.join(
      ", "
    )}. Re-generate the full week plan using only ids from the provided library, or set exerciseId to null with a nameOverride.`;
    plan = await requestPlanFromClaude(system, userMessage, expectedWeek, correction);
    invalid = findInvalidExerciseIds(plan, validIds);
  }

  const hasUnverified = invalid.length > 0;
  if (hasUnverified) {
    plan = markUnverified(plan, validIds);
  }
  return { plan, hasUnverified };
}

export async function POST() {
  try {
    const profile = await getLatestProfile();
    if (!profile) {
      return NextResponse.json(
        { error: "Please fill out your profile before generating a plan." },
        { status: 400 }
      );
    }
    const gymData = await getLatestGymWithEquipment();
    if (!gymData || gymData.items.length === 0) {
      return NextResponse.json(
        { error: "Please set up your gym equipment before generating a plan." },
        { status: 400 }
      );
    }

    const eligible = await getEligibleExercises(
      gymData.items.map((i) => ({ name: i.name, category: i.category, details: i.details }))
    );
    const validIds = new Set(eligible.map((e) => e.id));
    const compactList = formatExerciseCompactList(eligible);

    const history = await getAllWeeksHistoryForPrompt();
    const nextWeekNumber =
      history.length > 0 ? Math.max(...history.map((w) => w.weekNumber)) + 1 : 1;

    const userMessage = `Generate week ${nextWeekNumber} of the training plan.

USER PROFILE:
${buildProfileSummary(profile)}

AVAILABLE GYM EQUIPMENT:
${buildEquipmentSummary(gymData.items)}

TRAINING HISTORY SO FAR:
${buildHistorySummary(history)}

VALID EXERCISE LIBRARY (tab-separated: id, name, equipment, primary muscles) — you may ONLY use ids from this list for "exerciseId":
${compactList}`;

    const system = buildPlanSystemPrompt();
    const { plan, hasUnverified } = await withRetryValidation(
      system,
      userMessage,
      validIds,
      nextWeekNumber
    );

    const now = new Date().toISOString();
    const [weekRow] = await db
      .insert(weeks)
      .values({ weekNumber: nextWeekNumber, createdAt: now })
      .returning();

    for (let dayIndex = 0; dayIndex < plan.days.length; dayIndex++) {
      const planDay = plan.days[dayIndex];
      const [dayRow] = await db
        .insert(days)
        .values({
          weekId: weekRow.id,
          orderIndex: dayIndex,
          dayLabel: planDay.dayLabel,
          focus: planDay.focus,
          warmup: planDay.warmup,
          cooldown: planDay.cooldown,
          cardioType: planDay.cardio?.type ?? null,
          cardioDurationMin: planDay.cardio?.durationMin ?? null,
          cardioIncline: planDay.cardio?.incline ?? null,
          cardioTargetHr: planDay.cardio?.targetHr ?? null,
        })
        .returning();

      for (let exIndex = 0; exIndex < planDay.exercises.length; exIndex++) {
        const ex = planDay.exercises[exIndex];
        await db.insert(exerciseEntries).values({
          dayId: dayRow.id,
          orderIndex: exIndex,
          exerciseId: ex.exerciseId,
          nameOverride: ex.nameOverride,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          restSec: ex.restSec,
          notes: ex.notes,
          unverified: ex.exerciseId === null && ex.nameOverride?.startsWith("Unverified") ? true : false,
        });
      }
    }

    return NextResponse.json({ weekId: weekRow.id, weekNumber: nextWeekNumber, hasUnverified });
  } catch (err) {
    console.error("plan generate error:", err);
    // TODO(beta): surfacing raw error details to the client for debugging.
    // Replace with a generic message before public launch.
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const message =
      err instanceof ClaudeError ? err.message : `Failed to generate the plan — ${detail}`;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
