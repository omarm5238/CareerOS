import type { ResumeAnalysisResult } from "../types";
import { analyzeResumeWithFallback } from "./fallback-resume-analyzer";
import {
  buildFallbackDiagnostic,
  logResumeAiFallback,
} from "./log-ai-fallback";
import { analyzeResumeWithOpenAI, isOpenAIConfigured } from "./openai-resume-analyzer";
import type { AnalyzeResumeWithAiInput } from "./types";

export async function analyzeResumeWithAi(
  input: AnalyzeResumeWithAiInput,
): Promise<ResumeAnalysisResult> {
  const resumeMeta = {
    filename: input.resumeMeta.filename,
    fileSize: input.resumeMeta.fileSize,
    textLength: input.text.length,
  };

  if (!isOpenAIConfigured()) {
    logResumeAiFallback(buildFallbackDiagnostic("missing_api_key"));
    return analyzeResumeWithFallback(input.text, resumeMeta, {
      extractionWarnings: input.extractionWarnings,
    });
  }

  const aiOutcome = await analyzeResumeWithOpenAI(input.text);

  if (!aiOutcome.success) {
    logResumeAiFallback(aiOutcome.diagnostic);
    return analyzeResumeWithFallback(input.text, resumeMeta, {
      includeAiUnavailableWarning: true,
      extractionWarnings: input.extractionWarnings,
    });
  }

  const mergedWarnings = [
    ...aiOutcome.analysis.warnings,
    ...(input.extractionWarnings ?? []),
  ].slice(0, 5);

  return {
    ...aiOutcome.analysis,
    warnings: mergedWarnings,
    aiWarnings: [],
    resume: resumeMeta,
  };
}
