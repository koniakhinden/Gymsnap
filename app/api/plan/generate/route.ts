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

async function requestPlanFromClaude(
  system: string,
  userMessage: string,
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
  return weekPlanSchema.parse(toolUse.input);
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
  validIds: Set<string>
): Promise<{ plan: WeekPlan; hasUnverified: boolean }> {
  let plan = await requestPlanFromClaude(system, userMessage);
  let invalid = findInvalidExerciseIds(plan, validIds);

  if (invalid.length > 0) {
    const correction = `Your previous plan referenced exerciseId(s) that don't exist in the valid exercise library or aren't available with the user's equipment: ${invalid.join(
      ", "
    )}. Re-generate the full week plan using only ids from the provided library, or set exerciseId to null with a nameOverride.`;
    plan = await requestPlanFromClaude(system, userMessage, correction);
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
      gymData.items.map((i) => ({ name: i.name, category: i.category }))
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
    const { plan, hasUnverified } = await withRetryValidation(system, userMessage, validIds);

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
    const message =
      err instanceof ClaudeError ? err.message : "Failed to generate the plan. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
