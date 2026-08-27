import { isAiConfigured, logAiFallback } from "@/server/ai";

import { buildFallbackResumeTailoringDraft } from "./fallback-resume-tailoring-draft";
import { tailorResumeForJobWithAi } from "./tailor-resume-for-job-with-ai";
import type { ResumeTailoringInput, ResumeTailoringResult } from "./types";

/**
 * Runs the AI tailoring engine and falls back to a conservative rule-based draft.
 * This never throws, so callers always get a storable revision payload.
 */
export async function resolveResumeTailoring(
  input: ResumeTailoringInput,
): Promise<ResumeTailoringResult> {
  if (!isAiConfigured()) {
    logAiFallback("resume-tailoring", {
      hasApiKey: false,
      model: "",
      reason: "missing_api_key",
    });
    return buildFallbackResumeTailoringDraft(input);
  }

  try {
    const outcome = await tailorResumeForJobWithAi(input);

    if (outcome.success) {
      return outcome.result;
    }

    logAiFallback("resume-tailoring", outcome.diagnostic);
    return buildFallbackResumeTailoringDraft(input);
  } catch (error) {
    logAiFallback("resume-tailoring", {
      hasApiKey: true,
      model: "",
      reason: "unexpected_error",
      message: error instanceof Error ? error.message : "Unknown tailoring error",
    });
    return buildFallbackResumeTailoringDraft(input);
  }
}
