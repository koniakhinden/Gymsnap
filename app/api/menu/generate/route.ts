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
import {
  menuRequestSchema,
  menuResultSchema,
  menuDaysOnlySchema,
  type MenuResult,
  type MenuDaysOnly,
  type MenuTargets,
} from "@/lib/validation/menu";

export const runtime = "nodejs";
// 300s takes effect on Vercel Pro; Hobby caps at 60s. The week is generated in
// two parts (days 1-4, then days 5-7 + shopping list) so each part fits 60s.
export const maxDuration = 300;

const daysTool: Anthropic.Tool = {
  name: "report_days",
  description: "Report the requested days of the menu (meals only).",
  input_schema: zodToJsonSchema(menuDaysOnlySchema, { $refStrategy: "none" }) as Anthropic.Tool.InputSchema,
};
const menuTool: Anthropic.Tool = {
  name: "report_menu",
  description: "Report the remaining days plus the consolidated weekly shopping list.",
  input_schema: zodToJsonSchema(menuResultSchema, { $refStrategy: "none" }) as Anthropic.Tool.InputSchema,
};

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceAiRateLimit(req, "menu");
    if (limited) return limited;

    const userId = await getUserId();
    const parsed = menuRequestSchema.parse(await req.json().catch(() => ({})));
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

    // Part 1: just days 1-4 (fast). Nothing stored yet.
    if (parsed.part === "days1") {
      const r = await callClaudeForTool<MenuDaysOnly>({
        system: buildMenuSystemPrompt(),
        messages: [
          {
            role: "user",
            content: buildMenuUserMessage({
              eaters,
              settings,
              pantry: parsed.pantry,
              part: "days1",
            }),
          },
        ],
        tool: daysTool,
        maxTokens: 5000,
        validate: (input) => menuDaysOnlySchema.parse(input),
      });
      return NextResponse.json({ days: r.days });
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

    // Part 2 (final): days 5-7 + the consolidated shopping list, given days 1-4.
    const finalPart = await callClaudeForTool<MenuResult>({
      system: buildMenuSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildMenuUserMessage({
            eaters,
            settings,
            pantry: parsed.pantry,
            part: "final",
            priorDays: parsed.priorDays,
          }),
        },
      ],
      tool: menuTool,
      maxTokens: 6000,
      validate: (input) => menuResultSchema.parse(input),
    });

    // Assemble the whole week: days 1-4 (from part 1) + days 5-7 (from part 2).
    const result: MenuResult = {
      ...finalPart,
      days: [...parsed.priorDays, ...finalPart.days],
    };

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
