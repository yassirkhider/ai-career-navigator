import { AIProvider } from "./types";
import { AnthropicProvider } from "./providers/anthropic";
import { DevMockProvider } from "./providers/dev-mock";

let cached: AIProvider | null = null;

/**
 * Single entry point the rest of the app uses to obtain an AIProvider.
 * Uses the real Anthropic API when ANTHROPIC_API_KEY is configured.
 * Falls back to the deterministic DevMockProvider only outside production,
 * so local/dev/test environments without a key can still exercise the
 * full pipeline. Production deployments MUST set ANTHROPIC_API_KEY.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    cached = new AnthropicProvider(apiKey);
  } else if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ANTHROPIC_API_KEY is required in production. See .env.example."
    );
  } else {
    console.warn(
      "[ai] ANTHROPIC_API_KEY not set — using DevMockProvider (heuristic, non-AI, dev/test only)."
    );
    cached = new DevMockProvider();
  }
  return cached;
}

export type { AIProvider } from "./types";
export { AIProviderError } from "./types";
