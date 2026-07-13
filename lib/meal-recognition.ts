import { zodToJsonSchema } from "zod-to-json-schema";
import Anthropic from "@anthropic-ai/sdk";
import { callClaudeForTool } from "@/lib/anthropic";
import { compressImage, toClaudeImageBlock } from "@/lib/equipment-recognition";
import { recognizedMealSchema, type RecognizedMeal } from "@/lib/validation/meal-log";

const MEAL_PROMPT = `You are GymSnap's nutrition assistant. You are shown 1-3 photos of something the user ate — a plate of food, a snack, or the PACKAGING / nutrition-facts label of a product (e.g. a protein bar or ready-made meal).

Your job: report the food and its calories and macros for the amount the person is realistically eating.

Rules:
- If a NUTRITION FACTS label or packaging is visible, READ the numbers from it. Report for the portion they'll actually eat: for a single-serve item (one bar, one ready meal), use the whole package; otherwise use one labelled serving. Note which in "note".
- If there is NO label (a plain plate of food), ESTIMATE calories and macros for a normal portion of what you see. Say "estimated" in "note".
- "name" should be short and specific (e.g. "Quest protein bar, cookies & cream", "Chicken rice bowl").
- calories is a whole number; proteinG/fatG/carbG are grams (numbers). Be reasonable, not precise — these are estimates.
- If you truly cannot tell what the food is, still give your best single guess.

Respond only by calling the report_meal tool.`;

const mealTool: Anthropic.Tool = {
  name: "report_meal",
  description: "Report the recognized meal with calories and macros.",
  input_schema: zodToJsonSchema(recognizedMealSchema, {
    $refStrategy: "none",
  }) as Anthropic.Tool.InputSchema,
};

export async function recognizeMealFromFiles(files: File[]): Promise<RecognizedMeal> {
  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImage(buffer, file.type);
    imageBlocks.push(toClaudeImageBlock(compressed));
  }

  const content: Anthropic.ContentBlockParam[] = [
    ...imageBlocks,
    { type: "text", text: "Here's what I ate. Report the meal and its nutrition as instructed." },
  ];

  return callClaudeForTool<RecognizedMeal>({
    system: MEAL_PROMPT,
    messages: [{ role: "user", content }],
    tool: mealTool,
    maxTokens: 1024,
    validate: (input) => recognizedMealSchema.parse(input),
  });
}
