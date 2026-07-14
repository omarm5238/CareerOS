import { isAiConfigured, logAiFallback } from "@/server/ai";
import type { ResumeModuleAnalysis } from "@/features/resume/types";

import type { JobMatchAnalysis } from "../types";
import { analyzeJobMatchWithAi } from "./analyze-job-match-with-ai";
import { analyzeJobMatchWithFallback } from "./fallback-job-match-analyzer";
import type {
  JobMatchAnalysisInput,
  JobMatchJobInput,
  JobMatchResumeInput,
} from "./types";

export function mapResumeToJobMatchInput(
  resume: ResumeModuleAnalysis,
): JobMatchResumeInput {
  return {
    detectedRole: resume.role,
    experienceLevel: resume.experienceLevel,
    completenessScore: resume.completenessScore,
    detectedSkills: resume.detectedSkills,
    profileSummary: resume.profileSummary ?? null,
    strengths: resume.strengths,
    weaknesses: resume.weaknesses,
    suggestedFocus: resume.suggestedFocus,
    atsRecommendations: resume.atsRecommendations,
  };
}

export function buildJobMatchInput(
  job: JobMatchJobInput,
  resume: ResumeModuleAnalysis | null,
): JobMatchAnalysisInput {
  return {
    job,
    resume: resume ? mapResumeToJobMatchInput(resume) : null,
  };
}

function buildAiUnavailableWarning(reason: string): string {
  if (reason === "missing_api_key") {
    return "AI analysis unavailable; using rule-based matching.";
  }

  if (reason === "timeout") {
    return "AI analysis timed out; using rule-based matching.";
  }

  if (reason === "json_validation_failed" || reason === "json_parse_failed") {
    return "AI response could not be validated; using rule-based matching.";
  }

  return "AI analysis unavailable; using rule-based matching.";
}

export async function resolveJobMatchAnalysis(
  input: JobMatchAnalysisInput,
): Promise<JobMatchAnalysis> {
  if (!isAiConfigured() || !input.resume) {
    return analyzeJobMatchWithFallback(input);
  }

  const aiOutcome = await analyzeJobMatchWithAi(input);

  if (aiOutcome.success) {
    return aiOutcome.analysis;
  }

  logAiFallback("job-match", aiOutcome.diagnostic);

  return analyzeJobMatchWithFallback(input, {
    aiWarnings: [buildAiUnavailableWarning(aiOutcome.diagnostic.reason)],
  });
}

export { isAiConfigured };
