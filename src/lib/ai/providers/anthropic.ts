import { z } from "zod";
import { AIProvider, AIProviderError } from "../types";
import { recordAiInteraction } from "../telemetry";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

/**
 * Real Anthropic provider. Requires ANTHROPIC_API_KEY server-side only —
 * never sent to or readable by the client.
 *
 * Structured output strategy: we instruct the model to respond with a single
 * JSON object only (no prose, no markdown fences), then parse + validate
 * against the caller's Zod schema. If validation fails we retry once with
 * the validation error fed back to the model so it can self-correct.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new AIProviderError("ANTHROPIC_API_KEY is not configured");
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateStructured<T>(args: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodType<T>;
    promptName: string;
    promptVersion: string;
    userId?: string;
    maxTokens?: number;
  }): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number } }> {
    const start = Date.now();
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const correctionNote =
          attempt === 0
            ? ""
            : `\n\nYour previous response did not match the required JSON schema. Error: ${String(
                lastError
              )}. Respond again with ONLY valid JSON matching the schema.`;

        const body = {
          model: this.model,
          // 4096 was the original default but proved too low in practice —
          // a real, detailed CV extraction (multiple roles, each with
          // responsibilities/achievements arrays plus verbatim evidence
          // quotes for every skill) can genuinely exceed it, truncating
          // the JSON mid-output and causing "Model did not return valid
          // JSON" failures that have nothing to do with the JSON itself
          // being malformed — the response was just cut off.
          max_tokens: args.maxTokens ?? 8192,
          system:
            args.systemPrompt +
            "\n\nIMPORTANT: Respond with ONLY a single valid JSON object. No markdown code fences, no commentary before or after." +
            correctionNote,
          messages: [{ role: "user", content: args.userPrompt }],
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const res = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const retryable = res.status === 429 || res.status >= 500;
          throw new AIProviderError(
            `Anthropic API error ${res.status}: ${text.slice(0, 500)}`,
            undefined,
            retryable
          );
        }

        const json = await res.json();
        const textBlock = (json.content || []).find(
          (b: { type: string }) => b.type === "text"
        );
        if (!textBlock) {
          throw new AIProviderError("No text block in Anthropic response");
        }

        const parsed = safeJsonParse(textBlock.text);
        const validated = args.schema.parse(parsed);

        // Diagnostic visibility: a request can validate successfully while
        // still producing surprisingly sparse/empty results (e.g. the model
        // decided a section had no confidently-extractable content). This
        // preview — visible via `docker compose logs app` — lets us see
        // what the model actually returned without needing a DB migration
        // just to debug a specific case.
        console.log(
          `[ai] ${args.promptName} success, response preview:`,
          JSON.stringify(validated).slice(0, 1500)
        );

        await recordAiInteraction({
          userId: args.userId,
          promptName: args.promptName,
          promptVersion: args.promptVersion,
          model: this.model,
          inputTokens: json.usage?.input_tokens,
          outputTokens: json.usage?.output_tokens,
          latencyMs: Date.now() - start,
          success: true,
        });

        return {
          data: validated,
          usage: {
            inputTokens: json.usage?.input_tokens ?? 0,
            outputTokens: json.usage?.output_tokens ?? 0,
          },
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        const retryable =
          err instanceof AIProviderError ? err.retryable : err instanceof z.ZodError;
        if (attempt === MAX_RETRIES || !retryable) {
          await recordAiInteraction({
            userId: args.userId,
            promptName: args.promptName,
            promptVersion: args.promptVersion,
            model: this.model,
            latencyMs: Date.now() - start,
            success: false,
            errorMessage: String(lastError).slice(0, 1000),
          });
          throw err instanceof AIProviderError
            ? err
            : new AIProviderError("AI generation failed", err);
        }
        // exponential backoff before retry
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      }
    }

    throw new AIProviderError("Unreachable");
  }
}

function safeJsonParse(text: string): unknown {
  const trimmed = text.trim();
  // Strip accidental markdown fences defensively even though we asked the model not to use them.
  const withoutFences = trimmed.replace(/^```(?:json)?\n?/, "").replace(/```$/, "");
  try {
    return JSON.parse(withoutFences);
  } catch (e) {
    // Include a preview of what the model actually returned — without
    // this, "Model did not return valid JSON" gives no way to diagnose
    // *why* (truncation vs. genuinely malformed vs. extra prose) without
    // a code change + redeploy just to add logging.
    const preview = withoutFences.slice(0, 300);
    const suffix = withoutFences.length > 300 ? "…" : "";
    throw new AIProviderError(
      `Model did not return valid JSON. Response preview (first 300 chars): ${preview}${suffix}`,
      e
    );
  }
}
