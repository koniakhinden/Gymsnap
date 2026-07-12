import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { db } from "@/lib/db";
import { quickMeals } from "@/lib/db/schema";
import { callClaudeForTool, ClaudeError } from "@/lib/anthropic";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-error";
import { getUserId } from "@/lib/user";
import { getEaters, getNutritionSettings } from "@/lib/nutrition-data";
import { getRecentMeals } from "@/lib/cook-data";
import { buildCookSystemPrompt, buildCookUserMessage } from "@/lib/cook-prompt";
import { computeEaterTargets } from "@/lib/nutrition";
import {
  cookRequestSchema,
  cookResultSchema,
  type CookResult,
} from "@/lib/validation/cook";

export const runtime = "nodejs";
export const maxDuration = 60;

const recipeTool: Anthropic.Tool = {
  name: "report_recipes",
  description: "Report the suggested recipe(s) the user can cook now.",
  input_schema: zodToJsonSchema(cookResultSchema, { $refStrategy: "none" }) as Anthropic.Tool.InputSchema,
};

export async function GET() {
  try {
    const userId = await getUserId();
    return NextResponse.json({ history: await getRecentMeals(userId, 5) });
  } catch (err) {
    return jsonError(err, "Failed to load recent meals.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceAiRateLimit(req, "cook");
    if (limited) return limited;

    const userId = await getUserId();
    const parsed = cookRequestSchema.parse(await req.json());

    const [eaters, settings] = await Promise.all([
      getEaters(userId),
      getNutritionSettings(userId),
    ]);

    // Rough per-serving calorie guide: primary eater's daily target / 3 meals,
    // or the manual override if set. Null when we have no profile.
    let approxCaloriesPerServing: number | null = null;
    const primary = eaters.find((e) => e.isSelf) ?? eaters[0];
    if (settings?.calorieTargetOverride) {
      approxCaloriesPerServing = Math.round(settings.calorieTargetOverride / 3);
    } else if (primary) {
      const t = computeEaterTargets({
        sex: primary.sex,
        ageYears: primary.ageYears,
        heightCm: primary.heightCm,
        weightKg: primary.weightKg,
        activity: primary.activity,
        goal: primary.goal,
      });
      approxCaloriesPerServing = Math.round(t.calories / 3);
    }

    const system = buildCookSystemPrompt();
    const userMessage = buildCookUserMessage({
      ingredients: parsed.ingredients,
      mealType: parsed.mealType,
      servings: parsed.servings,
      note: parsed.note,
      eaters,
      settings,
      approxCaloriesPerServing,
    });

    const result = await callClaudeForTool<CookResult>({
      system,
      messages: [{ role: "user", content: userMessage }],
      tool: recipeTool,
      maxTokens: 4000,
      validate: (input) => cookResultSchema.parse(input),
    });

    const now = new Date().toISOString();
    const [row] = await db
      .insert(quickMeals)
      .values({
        userId,
        source: parsed.source,
        ingredients: parsed.ingredients,
        mealType: parsed.mealType,
        servings: parsed.servings,
        note: parsed.note,
        result,
        createdAt: now,
      })
      .returning();

    return NextResponse.json({ id: row.id, meal: result });
  } catch (err) {
    if (err instanceof ClaudeError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return jsonError(err, "Failed to build the recipe.");
  }
}
