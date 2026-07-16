import { isAiConfigured, logAiFallback } from "@/server/ai";
import type { ResumeModuleAnalysis } from "@/features/resume/types";

import type { SkillsOverview } from "../types";
import { analyzeSkillsWithAi } from "./analyze-skills-with-ai";
import { buildFallbackSkillsInsight } from "./fallback-skills-insight";
import type {
  SkillsInsightAnalysisInput,
  SkillsInsightResult,
  SkillsJobAnalysisInput,
  SkillsResumeInput,
} from "./types";

function isTimeoutOrAbortReason(reason: string): boolean {
  return reason === "timeout" || reason === "request_aborted";
}

function buildAiUnavailableWarning(reason: string): string {
  if (reason === "missing_api_key") {
    return "AI strategy unavailable; using rule-based insight.";
  }

  if (isTimeoutOrAbortReason(reason)) {
    return "AI strategy timed out; using rule-based insight.";
  }

  if (reason === "json_validation_failed" || reason === "json_parse_failed") {
    return "AI response could not be validated; using rule-based insight.";
  }

  return "AI strategy unavailable; using rule-based insight.";
}

export function mapResumeToSkillsInput(resume: ResumeModuleAnalysis): SkillsResumeInput {
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

export function buildSkillsInsightInput(
  resume: ResumeModuleAnalysis,
  jobs: SkillsJobAnalysisInput[],
  overview: SkillsOverview,
): SkillsInsightAnalysisInput {
  return {
    resume: mapResumeToSkillsInput(resume),
    jobs,
    overview,
  };
}

export async function resolveSkillsInsight(
  input: SkillsInsightAnalysisInput,
): Promise<SkillsInsightResult> {
  if (!isAiConfigured()) {
    return buildFallbackSkillsInsight(input);
  }

  const aiOutcome = await analyzeSkillsWithAi(input);

  if (aiOutcome.success) {
    return aiOutcome.analysis;
  }

  logAiFallback("skills-insight", aiOutcome.diagnostic);

  return buildFallbackSkillsInsight(input, {
    aiWarnings: [buildAiUnavailableWarning(aiOutcome.diagnostic.reason)],
  });
}

export { isAiConfigured };
