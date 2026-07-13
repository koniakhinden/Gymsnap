import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { db } from "@/lib/db";
import { menuWeeks } from "@/lib/db/schema";
import { callClaudeForTool, ClaudeError } from "@/lib/anthropic";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-error";
import { getUserId } from "@/lib/user";
import { getEaters, getNutritionSettings } from "@/lib/nutrition-data";
import { nextMenuWeekNumber } from "@/lib/menu-data";
import { buildMenuSystemPrompt, buildMenuUserMessage } from "@/lib/menu-prompt";
import { computeHouseholdTargets, computeEaterTargets } from "@/lib/nutrition";
import { menuResultSchema, type MenuResult, type MenuTargets } from "@/lib/validation/menu";

export const runtime = "nodejs";
export const maxDuration = 60;

const menuTool: Anthropic.Tool = {
  name: "report_menu",
  description: "Report the 7-day menu and consolidated weekly shopping list.",
  input_schema: zodToJsonSchema(menuResultSchema, { $refStrategy: "none" }) as Anthropic.Tool.InputSchema,
};

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceAiRateLimit(req, "menu");
    if (limited) return limited;

    const userId = await getUserId();
    const [eaters, settings] = await Promise.all([
      getEaters(userId),
      getNutritionSettings(userId),
    ]);
    if (eaters.length === 0) {
      return NextResponse.json(
        { error: "Add at least one person in Food setup first." },
        { status: 400 }
      );
    }

    const inputs = eaters.map((e) => ({
      sex: e.sex,
      ageYears: e.ageYears,
      heightCm: e.heightCm,
      weightKg: e.weightKg,
      activity: e.activity,
      goal: e.goal,
    }));
    const household = computeHouseholdTargets(inputs);
    const primary = eaters.find((e) => e.isSelf) ?? eaters[0];
    const primaryCals =
      settings?.calorieTargetOverride ?? computeEaterTargets(inputs[eaters.indexOf(primary)]).calories;
    const targets: MenuTargets = {
      eaters: eaters.length,
      perPersonCalories: primaryCals,
      householdCalories: household.calories,
      proteinG: household.proteinG,
      fatG: household.fatG,
      carbG: household.carbG,
    };

    const result = await callClaudeForTool<MenuResult>({
      system: buildMenuSystemPrompt(),
      messages: [{ role: "user", content: buildMenuUserMessage({ eaters, settings }) }],
      tool: menuTool,
      // Kept moderate so a full week generates within the 60s function limit
      // (a leaner, concise menu — see the prompt's conciseness rule).
      maxTokens: 9000,
      validate: (input) => menuResultSchema.parse(input),
    });

    const weekNumber = await nextMenuWeekNumber(userId);
    const now = new Date().toISOString();
    await db.insert(menuWeeks).values({ userId, weekNumber, targets, result, createdAt: now });

    return NextResponse.json({ weekNumber });
  } catch (err) {
    if (err instanceof ClaudeError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return jsonError(err, "Failed to build the menu.");
  }
}
