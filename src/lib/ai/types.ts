import { z } from "zod";

/**
 * AIProvider is the single abstraction the rest of the application talks to.
 * Nothing outside src/lib/ai should import an SDK or call a vendor API directly.
 * This lets us swap Anthropic <-> OpenAI <-> a test double without touching
 * any route, prompt-writer, or UI code (Spec section 29).
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Ask the model to produce output matching `schema`. The provider is
   * responsible for instructing the model to return only JSON, validating
   * the parsed result against `schema`, and retrying on transient failure
   * or schema-validation failure (once).
   */
  generateStructured<T>(args: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodType<T>;
    promptName: string;
    promptVersion: string;
    userId?: string;
    maxTokens?: number;
  }): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number } }>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
