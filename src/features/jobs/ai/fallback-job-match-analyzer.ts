import { analyzeJobMatchRuleBased } from "../lib/analyze-job-match-rule-based";
import type { JobMatchAnalysis } from "../types";
import type { JobMatchAnalysisInput } from "./types";

type FallbackOptions = {
  aiWarnings?: string[];
};

export function analyzeJobMatchWithFallback(
  input: JobMatchAnalysisInput,
  options: FallbackOptions = {},
): JobMatchAnalysis {
  const ruleBased = analyzeJobMatchRuleBased({
    title: input.job.title,
    description: input.job.description,
    resume: input.resume
      ? {
          role: input.resume.detectedRole,
          experienceLevel: input.resume.experienceLevel,
          detectedSkills: input.resume.detectedSkills,
        }
      : null,
  });

  const aiWarnings = [...(options.aiWarnings ?? [])];
  if (aiWarnings.length === 0 && !input.resume) {
    aiWarnings.push("Upload or analyze a resume to improve job matching.");
  }

  return {
    ...ruleBased,
    analysisSource: "rule_based",
    aiModel: null,
    fitSummary: null,
    applicationStrategy: [],
    resumeTailoringTips: [],
    aiWarnings: aiWarnings.slice(0, 6),
  };
}
