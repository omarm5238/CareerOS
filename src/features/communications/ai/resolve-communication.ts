import { isAiConfigured, logAiFallback } from "@/server/ai";

import type { CommunicationContext } from "../types";
import { buildFallbackCommunication } from "./fallback-communication";
import { generateCommunicationWithAi } from "./generate-communication";
import type { CommunicationResolveResult } from "./types";

export async function resolveCommunication(
  context: CommunicationContext,
): Promise<CommunicationResolveResult> {
  if (!isAiConfigured()) {
    logAiFallback("communication-generate", {
      hasApiKey: false,
      model: "",
      reason: "missing_api_key",
    });
    return {
      output: buildFallbackCommunication(context),
      source: "RULE_BASED_FALLBACK",
      model: null,
      aiSource: "rule_based",
    };
  }

  try {
    const outcome = await generateCommunicationWithAi(context);
    if (outcome.success) {
      return {
        output: outcome.payload,
        source: "AI_GENERATED",
        model: outcome.model,
        aiSource: "ai",
      };
    }

    logAiFallback("communication-generate", outcome.diagnostic);
    return {
      output: buildFallbackCommunication(context),
      source: "RULE_BASED_FALLBACK",
      model: null,
      aiSource: "rule_based",
    };
  } catch (error) {
    logAiFallback("communication-generate", {
      hasApiKey: true,
      model: "",
      reason: "unexpected_error",
      message: error instanceof Error ? error.message : "Unknown communication error",
    });
    return {
      output: buildFallbackCommunication(context),
      source: "RULE_BASED_FALLBACK",
      model: null,
      aiSource: "rule_based",
    };
  }
}
