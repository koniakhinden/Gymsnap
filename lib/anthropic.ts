import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeError(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server."
    );
  }
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 90_000,
    });
  }
  return client;
}

export class ClaudeError extends Error {}

/**
 * Calls Claude with a single forced tool call so the response is structured JSON,
 * retrying once on failure (timeout, API error, or malformed tool input).
 */
export async function callClaudeForTool<T>({
  system,
  messages,
  tool,
  maxTokens,
  validate,
}: {
  system: string;
  messages: Anthropic.MessageParam[];
  tool: Anthropic.Tool;
  maxTokens: number;
  validate: (input: unknown) => T;
}): Promise<T> {
  const anthropic = getAnthropicClient();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system,
        messages:
          attempt === 0
            ? messages
            : [
                ...messages,
                {
                  role: "user",
                  content: `Your previous response was invalid: ${String(
                    lastError
                  )}. Please try again and strictly follow the tool's input schema.`,
                },
              ],
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      });

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );
      if (!toolUse) {
        throw new ClaudeError("Claude did not return a tool call.");
      }
      return validate(toolUse.input);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === 1) {
        throw new ClaudeError(
          `Claude request failed after retry: ${lastError}`
        );
      }
    }
  }
  throw new ClaudeError("Unreachable");
}
