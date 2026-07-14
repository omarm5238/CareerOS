import { generateJsonWithAI, isAiConfigured } from "@/server/ai";

import { limitResumeTextForAi } from "./limit-resume-text-for-ai";
import { buildFallbackDiagnostic } from "./log-ai-fallback";
import {
  RESUME_ANALYSIS_SYSTEM_PROMPT,
  buildResumeAnalysisUserPrompt,
} from "./prompts";
import {
  isValidResumeAIAnalysis,
  sanitizeResumeAIAnalysis,
} from "./resume-analysis-schema";
import type { OpenAIResumeAnalysisPayload, ResumeAIAnalysisCore } from "./types";
import type { ResumeAiFallbackDiagnostic } from "./log-ai-fallback";

export type AnalyzeResumeOpenAIResult =
  | { success: true; analysis: ResumeAIAnalysisCore }
  | { success: false; diagnostic: ResumeAiFallbackDiagnostic };

export async function analyzeResumeWithOpenAI(
  text: string,
): Promise<AnalyzeResumeOpenAIResult> {
  const { text: limitedText, truncated } = limitResumeTextForAi(text);

  const aiResult = await generateJsonWithAI<OpenAIResumeAnalysisPayload>({
    taskName: "resume-analysis",
    systemPrompt: RESUME_ANALYSIS_SYSTEM_PROMPT,
    userPrompt: buildResumeAnalysisUserPrompt({
      resumeText: limitedText,
      truncated,
    }),
    fallbackLabel: "resume-analysis",
  });

  if (!aiResult.ok) {
    return {
      success: false,
      diagnostic: aiResult.diagnostic,
    };
  }

  const sanitized = sanitizeResumeAIAnalysis(aiResult.data, {
    analysisSource: "ai",
    model: aiResult.model,
  });

  if (!sanitized || !isValidResumeAIAnalysis(sanitized)) {
    return {
      success: false,
      diagnostic: buildFallbackDiagnostic("json_validation_failed", {
        jsonValidationFailed: true,
      }),
    };
  }

  if (truncated) {
    sanitized.warnings = [
      "Resume text was truncated before AI analysis.",
      ...sanitized.warnings,
    ].slice(0, 5);
  }

  return { success: true, analysis: sanitized };
}

export function isOpenAIConfigured(): boolean {
  return isAiConfigured();
}
