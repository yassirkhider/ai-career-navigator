import { db } from "@/lib/db/client";
import { aiInteractions } from "@/lib/db/schema";

export async function recordAiInteraction(args: {
  userId?: string;
  promptName: string;
  promptVersion: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await db.insert(aiInteractions).values({
      userId: args.userId,
      promptName: args.promptName,
      promptVersion: args.promptVersion,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      latencyMs: args.latencyMs,
      success: args.success,
      errorMessage: args.errorMessage,
    });
  } catch (e) {
    // Telemetry must never break the primary request path.
    console.error("[telemetry] failed to record AI interaction", e);
  }
}
