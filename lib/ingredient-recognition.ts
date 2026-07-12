import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { zodToJsonSchema } from "zod-to-json-schema";
import Anthropic from "@anthropic-ai/sdk";
import { callClaudeForTool } from "@/lib/anthropic";
import { compressImage, toClaudeImageBlock } from "@/lib/equipment-recognition";
import {
  recognizeIngredientsResponseSchema,
  type RecognizeIngredientsResponse,
} from "@/lib/validation/cook";

const INGREDIENT_PROMPT = `You are a food recognition assistant for GymSnap's "Cook now" feature.
You will be shown 1-10 photos of the inside of a fridge, freezer, or pantry shelves.

Your job: extract a single, de-duplicated list of the FOOD INGREDIENTS visible across ALL photos.

Rules:
- Scan each photo edge to edge; list every distinct food item, including ones in the back or in door shelves.
- The same jar/bottle/pack seen in two photos is ONE item — de-duplicate.
- Report an approximate quantity in "quantity" when you can tell (e.g. "half a dozen", "~500 g pack", "nearly empty", "2 bottles"). Otherwise leave it short or empty.
- Classify each into exactly one category: "produce" (fruit/veg/herbs), "protein" (meat/fish/eggs/tofu/legumes), "dairy" (milk/cheese/yogurt/butter), "grain" (rice/pasta/bread/oats/buckwheat/flour), "pantry" (canned goods, oils, spices, sauces staples), "condiment" (ketchup/mustard/jam/dressings), "frozen", "bakery", "beverage", or "other".
- Set "confidence" to "low" when an item is blurry, far, partially hidden, or you are guessing what's inside an opaque container.
- Do NOT invent food that isn't clearly visible. Ignore non-food objects and people.
- Keep "name" short and specific (e.g. "Eggs", "Cheddar cheese", "Baby spinach", "Chicken breast", "Buckwheat").

Respond only by calling the report_ingredients tool.`;

const ingredientTool: Anthropic.Tool = {
  name: "report_ingredients",
  description: "Report the de-duplicated list of food ingredients recognized across the photos.",
  input_schema: zodToJsonSchema(recognizeIngredientsResponseSchema, {
    $refStrategy: "none",
  }) as Anthropic.Tool.InputSchema,
};

export async function recognizeIngredientsFromFiles(
  files: File[]
): Promise<RecognizeIngredientsResponse & { photoUrls: string[] }> {
  const photoUrls: string[] = [];
  const imageBlocks: Anthropic.ImageBlockParam[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImage(buffer, file.type);
    const blob = await put(`fridge-photos/${randomUUID()}.jpg`, compressed, {
      access: "public",
      contentType: "image/jpeg",
    });
    photoUrls.push(blob.url);
    imageBlocks.push(toClaudeImageBlock(compressed));
  }

  const content: Anthropic.ContentBlockParam[] = [
    ...imageBlocks,
    { type: "text", text: "Here are photos of my fridge/pantry. Extract the ingredient list as instructed." },
  ];

  const result = await callClaudeForTool<RecognizeIngredientsResponse>({
    system: INGREDIENT_PROMPT,
    messages: [{ role: "user", content }],
    tool: ingredientTool,
    maxTokens: 4096,
    validate: (input) => recognizeIngredientsResponseSchema.parse(input),
  });

  return { items: result.items, photoUrls };
}
