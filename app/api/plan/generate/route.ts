import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Weekly plan generation is a long Claude call and may run several sequential
// correction passes (invalid ids, balance guard), so 60s is not enough for
// later weeks with more history — it was hitting FUNCTION_INVOCATION_TIMEOUT.
// Match the menu generator's ceiling.
export const maxDuration = 300;
import { zodToJsonSchema } from "zod-to-json-schema";
import { db } from "@/lib/db";
import { weeks, days, exerciseEntries } from "@/lib/db/schema";
import { getAnthropicClient, CLAUDE_MODEL, ClaudeError } from "@/lib/anthropic";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-error";
import { weekPlanSchema, type WeekPlan } from "@/lib/validation/plan";
import {
  getLatestProfile,
  getLatestGymWithEquipment,
  getAllWeeksHistoryForPrompt,
} from "@/lib/plan-data";
import { getEligibleExercises, formatExerciseCompactList } from "@/lib/exercises";
import {
  buildLadderLibraryText,
  isMinimalLoadGym,
  findBalanceViolations,
} from "@/lib/movement-patterns";
import { getUserId } from "@/lib/user";
import {
  buildProfileSummary,
  buildEquipmentSummary,
  buildHistorySummary,
  buildPlanSystemPrompt,
} from "@/lib/plan-prompt";

export const runtime = "nodejs";
const MAX_TOKENS = 16000;

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
      dayObj.warmupItems = tryParseJson(dayObj.warmupItems);
      // "reps" and "weight" are string fields ("8-10", "3kg"), but the model
      // sometimes emits them as bare numbers. Coerce so a single formatting
      // quirk doesn't fail an otherwise-valid plan.
      if (Array.isArray(dayObj.exercises)) {
        dayObj.exercises = dayObj.exercises.map((e) => {
          if (!e || typeof e !== "object" || Array.isArray(e)) return e;
          const exObj: Record<string, unknown> = { ...(e as Record<string, unknown>) };
          if (typeof exObj.reps === "number") exObj.reps = String(exObj.reps);
          if (typeof exObj.weight === "number") exObj.weight = String(exObj.weight);
          // Alternatives may arrive as a JSON string; parse before Zod runs.
          exObj.alternatives = tryParseJson(exObj.alternatives);
          return exObj;
        });
      }
      return dayObj;
    });
  }

  // Week-level stretch blocks may arrive as a JSON string, and each block's
  // items likewise.
  obj.stretchBlocks = tryParseJson(obj.stretchBlocks);
  if (Array.isArray(obj.stretchBlocks)) {
    obj.stretchBlocks = obj.stretchBlocks.map((b) => {
      const block = tryParseJson(b);
      if (!block || typeof block !== "object" || Array.isArray(block)) return block;
      const blockObj: Record<string, unknown> = { ...(block as Record<string, unknown>) };
      blockObj.items = tryParseJson(blockObj.items);
      return blockObj;
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

  if (response.stop_reason === "max_tokens") {
    // The tool call was cut off mid-JSON — no amount of repair can recover
    // a truncated payload, so fail fast with a distinct, retryable error.
    throw new ClaudeError(
      "Claude's response was truncated before the plan finished generating (hit max_tokens)."
    );
  }

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
      for (const alt of ex.alternatives) {
        if (alt.exerciseId && !validIds.has(alt.exerciseId)) {
          invalid.add(alt.exerciseId);
        }
      }
    }
    for (const item of day.warmupItems) {
      if (item.exerciseId && !validIds.has(item.exerciseId)) invalid.add(item.exerciseId);
    }
  }
  for (const block of plan.stretchBlocks) {
    for (const item of block.items) {
      if (item.exerciseId && !validIds.has(item.exerciseId)) invalid.add(item.exerciseId);
    }
  }
  return [...invalid];
}

// Drop an invalid library id on a warmup/stretch item, keeping it as a described
// move (null id + a name so the app can still show it).
function cleanRoutineItem<T extends { exerciseId: string | null; nameOverride: string | null }>(
  item: T,
  validIds: Set<string>
): T {
  if (item.exerciseId && !validIds.has(item.exerciseId)) {
    return { ...item, nameOverride: item.nameOverride ?? "Movement", exerciseId: null };
  }
  return item;
}

function markUnverified(plan: WeekPlan, validIds: Set<string>): WeekPlan {
  return {
    ...plan,
    stretchBlocks: plan.stretchBlocks.map((b) => ({
      ...b,
      items: b.items.map((it) => cleanRoutineItem(it, validIds)),
    })),
    days: plan.days.map((day) => ({
      ...day,
      warmupItems: day.warmupItems.map((it) => cleanRoutineItem(it, validIds)),
      exercises: day.exercises.map((ex) => {
        // Drop invalid ids on alternatives too, but keep them as described
        // movements (null id + nameOverride) rather than marking them unverified.
        const alternatives = ex.alternatives.map((alt) =>
          alt.exerciseId && !validIds.has(alt.exerciseId)
            ? {
                ...alt,
                nameOverride: alt.nameOverride ?? `Alternative (${alt.exerciseId})`,
                exerciseId: null,
              }
            : alt
        );
        if (ex.exerciseId && !validIds.has(ex.exerciseId)) {
          return {
            ...ex,
            nameOverride: ex.nameOverride ?? `Unverified exercise (${ex.exerciseId})`,
            exerciseId: null,
            alternatives,
          };
        }
        return { ...ex, alternatives };
      }),
    })),
  };
}

async function withRetryValidation(
  system: string,
  userMessage: string,
  validIds: Set<string>,
  expectedWeek: number,
  balance: {
    bodyWeightKg: number;
    equipmentById: Map<string, { equipment: string | null; mechanic: string | null }>;
  }
): Promise<{ plan: WeekPlan; hasUnverified: boolean }> {
  let plan: WeekPlan;
  try {
    plan = await requestPlanFromClaude(system, userMessage, expectedWeek);
  } catch (err) {
    // One retry when the model returned a malformed or truncated plan.
    if (err instanceof ClaudeError && err.message.includes("truncated")) {
      plan = await requestPlanFromClaude(
        system,
        userMessage,
        expectedWeek,
        `Your previous response was cut off before it finished (it hit the output length limit). Return the COMPLETE week plan again, but keep "notes", "warmup", and "cooldown" text brief (one short sentence each) so the full plan fits.`
      );
    } else if (err instanceof ClaudeError && err.message.includes("invalid plan format")) {
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

  // Balance guard: one corrective pass if any exercise is prescribed at a
  // near-zero load relative to body weight (see findBalanceViolations). Non-fatal
  // — if the model can't fix it, we still return the plan.
  const violations = findBalanceViolations(plan, balance);
  if (violations.length > 0) {
    const detail = violations
      .map((v) => `- ${v.exerciseId} (${v.dayLabel}): ${v.reason}`)
      .join("\n");
    const correction = `Your previous plan prescribes loads that are near-zero relative to the user's body weight, so those exercises give almost no training stimulus (target is RIR 2-3):\n${detail}\nRe-generate the full week plan. Replace each of those movements with an angle-scaled bodyweight ladder rung at the right effort (for a pull, use the horizontal row whose difficulty scales with torso angle), or a variable-load option (backpack/jug) heavy enough to reach RIR 2-3. Keep everything else balanced — no near-zero and no barely-possible exercises in the same day.`;
    const corrected = await requestPlanFromClaude(system, userMessage, expectedWeek, correction);
    const stillInvalid = findInvalidExerciseIds(corrected, validIds);
    plan = stillInvalid.length > 0 ? markUnverified(corrected, validIds) : corrected;
    return { plan, hasUnverified: hasUnverified || stillInvalid.length > 0 };
  }

  return { plan, hasUnverified };
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceAiRateLimit(req, "plan-generate");
    if (limited) return limited;

    const userId = await getUserId();
    const profile = await getLatestProfile(userId);
    if (!profile) {
      return NextResponse.json(
        { error: "Please fill out your profile before generating a plan." },
        { status: 400 }
      );
    }
    const gymData = await getLatestGymWithEquipment(userId);
    if (!gymData || gymData.items.length === 0) {
      return NextResponse.json(
        { error: "Please set up your gym equipment before generating a plan." },
        { status: 400 }
      );
    }

    const gymRefs = gymData.items.map((i) => ({
      name: i.name,
      category: i.category,
      details: i.details,
    }));
    const eligible = await getEligibleExercises(gymRefs);
    const validIds = new Set(eligible.map((e) => e.id));
    const compactList = formatExerciseCompactList(eligible);

    const equipmentById = new Map(
      eligible.map((e) => [e.id, { equipment: e.equipment, mechanic: e.mechanic }])
    );
    const bodyWeightKg =
      profile.weightUnit === "lbs" ? profile.bodyWeight * 0.453592 : profile.bodyWeight;
    const minimalLoad = isMinimalLoadGym(gymRefs);
    const ladderBlock = `BODYWEIGHT / VARIABLE-LOAD LADDERS (each ordered easiest -> hardest; pick the rung that puts THIS user at RIR 2-3):
${buildLadderLibraryText()}${
      minimalLoad
        ? `\n\nNOTE: this gym has no meaningfully loadable equipment (only body weight and/or light free weights). Light fixed weights cannot scale to this user, so build the session primarily from the ladders above, choosing rungs by the user's body weight and level.`
        : ""
    }`;

    const history = await getAllWeeksHistoryForPrompt(userId);
    const nextWeekNumber =
      history.length > 0 ? Math.max(...history.map((w) => w.weekNumber)) + 1 : 1;

    const userMessage = `Generate week ${nextWeekNumber} of the training plan.

USER PROFILE:
${buildProfileSummary(profile)}

AVAILABLE GYM EQUIPMENT:
${buildEquipmentSummary(gymData.items)}

TRAINING HISTORY SO FAR:
${buildHistorySummary(history)}

${ladderBlock}

VALID EXERCISE LIBRARY (tab-separated: id, name, equipment, primary muscles) — you may ONLY use ids from this list for "exerciseId":
${compactList}`;

    const system = buildPlanSystemPrompt();
    const { plan, hasUnverified } = await withRetryValidation(
      system,
      userMessage,
      validIds,
      nextWeekNumber,
      { bodyWeightKg, equipmentById }
    );

    const now = new Date().toISOString();
    const [weekRow] = await db
      .insert(weeks)
      .values({
        userId,
        weekNumber: nextWeekNumber,
        createdAt: now,
        stretchBlocks: plan.stretchBlocks,
      })
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
          warmupItems: planDay.warmupItems,
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
          alternatives: ex.alternatives,
        });
      }
    }

    return NextResponse.json({ weekId: weekRow.id, weekNumber: nextWeekNumber, hasUnverified });
  } catch (err) {
    // Curated ClaudeError messages are safe to show; anything else is generalized.
    if (err instanceof ClaudeError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return jsonError(err, "Failed to generate the plan.");
  }
}
