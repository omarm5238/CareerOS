import { generateJsonWithAI, getAiConfig, type AiDiagnostic } from "@/server/ai";

import { limitJobDescriptionForAi } from "./limit-job-text-for-ai";
import {
  isValidJobMatchAIAnalysis,
  sanitizeJobMatchAIAnalysis,
} from "./job-match-schema";
import { JOB_MATCH_SYSTEM_PROMPT, buildJobMatchUserPrompt } from "./prompts";
import type {
  JobMatchAIAnalysisPayload,
  JobMatchAnalysisInput,
  JobMatchAnalysisResult,
} from "./types";

export type AnalyzeJobMatchWithAiResult =
  | { success: true; analysis: JobMatchAnalysisResult }
  | { success: false; diagnostic: AiDiagnostic };

export async function analyzeJobMatchWithAi(
  input: JobMatchAnalysisInput,
): Promise<AnalyzeJobMatchWithAiResult> {
  if (!input.resume) {
    return {
      success: false,
      diagnostic: {
        hasApiKey: false,
        model: "",
        reason: "missing_resume_profile",
      },
    };
  }

  const { text: limitedDescription, truncated } = limitJobDescriptionForAi(
    input.job.description,
  );

  const aiResult = await generateJsonWithAI<JobMatchAIAnalysisPayload>({
    taskName: "job-match",
    systemPrompt: JOB_MATCH_SYSTEM_PROMPT,
    userPrompt: buildJobMatchUserPrompt({
      resume: input.resume,
      job: {
        ...input.job,
        description: limitedDescription,
        descriptionTruncated: truncated,
      },
    }),
    fallbackLabel: "job-match",
  });

  if (!aiResult.ok) {
    return { success: false, diagnostic: aiResult.diagnostic };
  }

  const sanitized = sanitizeJobMatchAIAnalysis(aiResult.data, aiResult.model);
  if (!sanitized || !isValidJobMatchAIAnalysis(sanitized)) {
    const config = getAiConfig();
    return {
      success: false,
      diagnostic: {
        hasApiKey: config.hasApiKey,
        model: aiResult.model,
        reason: "json_validation_failed",
        jsonValidationFailed: true,
      },
    };
  }

  if (truncated) {
    sanitized.aiWarnings = [
      "Job description was truncated before AI analysis.",
      ...sanitized.aiWarnings,
    ].slice(0, 6);
  }

  return { success: true, analysis: sanitized };
}
