import { isAiConfigured, logAiFallback } from "@/server/ai";
import {
  filterMarketSkillsOnly,
  isValidMarketSkillName,
} from "@/features/shared/insights";
import type { ResumeModuleAnalysis } from "@/features/resume/types";

import type { SkillsOverview } from "../types";
import { analyzeSkillsWithAi } from "./analyze-skills-with-ai";
import { buildFallbackSkillsInsight } from "./fallback-skills-insight";
import type {
  SkillsInsightAnalysisInput,
  SkillsInsightProjectIdea,
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

export function buildZeroJobsSkillsInsight(
  overview: SkillsOverview,
): SkillsInsightResult {
  return {
    skillCoverageScore: overview.skillCoverageScore,
    prioritySkills: [],
    learningRoadmap: [],
    projectIdeas: [],
    resumeSkillAdvice: [],
    marketSignals: [],
    warnings: [
      "No saved jobs yet. Add at least one target job to generate market-driven skill priorities.",
    ],
    analysisSource: "rule_based",
    aiModel: null,
  };
}

function sanitizeProjectIdeas(
  ideas: SkillsInsightProjectIdea[],
): SkillsInsightProjectIdea[] {
  return ideas
    .filter((idea) => {
      const title = idea.title.trim().toLowerCase();
      if (!title) return false;
      if (
        title.includes("open-source contribution") ||
        title.includes("certification preparation") ||
        title.includes("impact measurement") ||
        title.includes("soft skills workshop")
      ) {
        return false;
      }
      return true;
    })
    .map((idea) => ({
      ...idea,
      skills: idea.skills.filter(isValidMarketSkillName),
    }))
    .slice(0, 4);
}

function finalizeSkillsInsight(
  input: SkillsInsightAnalysisInput,
  result: SkillsInsightResult,
): SkillsInsightResult {
  if (input.jobs.length === 0) {
    return buildZeroJobsSkillsInsight(input.overview);
  }

  const prioritySkills = filterMarketSkillsOnly(result.prioritySkills);

  if (prioritySkills.length === 0) {
    return buildFallbackSkillsInsight(input);
  }

  return {
    ...result,
    prioritySkills: prioritySkills.slice(0, 6),
    projectIdeas: sanitizeProjectIdeas(result.projectIdeas),
    resumeSkillAdvice: filterMarketSkillsOnly(result.resumeSkillAdvice).slice(0, 6),
    learningRoadmap: result.learningRoadmap.map((item) => ({
      ...item,
      skills: item.skills.filter(isValidMarketSkillName),
    })),
  };
}

export async function resolveSkillsInsight(
  input: SkillsInsightAnalysisInput,
): Promise<SkillsInsightResult> {
  if (input.jobs.length === 0) {
    return buildZeroJobsSkillsInsight(input.overview);
  }

  if (!isAiConfigured()) {
    return finalizeSkillsInsight(input, buildFallbackSkillsInsight(input));
  }

  const aiOutcome = await analyzeSkillsWithAi(input);

  if (aiOutcome.success) {
    return finalizeSkillsInsight(input, aiOutcome.analysis);
  }

  logAiFallback("skills-insight", aiOutcome.diagnostic);

  return finalizeSkillsInsight(
    input,
    buildFallbackSkillsInsight(input, {
      aiWarnings: [buildAiUnavailableWarning(aiOutcome.diagnostic.reason)],
    }),
  );
}

export { isAiConfigured };
