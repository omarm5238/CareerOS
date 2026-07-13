import { analyzeResumeTextMock } from "../lib/analyze-resume-text-mock";
import { detectResumeDomain } from "../lib/detect-resume-domain";
import type { ResumeAnalysisResult } from "../types";
import type { ResumeAIAnalysisCore } from "./types";

const AI_FALLBACK_WARNING = "AI analysis unavailable; rule-based analysis was used.";

function buildRuleBasedEnhancements(
  base: ReturnType<typeof analyzeResumeTextMock>,
  text: string,
): Pick<
  ResumeAIAnalysisCore,
  "strengths" | "weaknesses" | "atsRecommendations" | "profileSummary" | "warnings"
> {
  const { domain } = detectResumeDomain(text);
  const strengths: string[] = [];

  if (base.detectedSkills.length > 0) {
    const label = domain === "software" ? "Technical skills identified" : "Skills identified";
    strengths.push(`${label}: ${base.detectedSkills.slice(0, 3).join(", ")}`);
  }

  if (base.completenessScore >= 70) {
    strengths.push("Resume includes core profile sections");
  } else {
    strengths.push("Resume provides a starting baseline for profile building");
  }

  if (base.role !== "General Professional" && base.role !== "Software Engineer") {
    strengths.push(`Clear role signal toward ${base.role}`);
  }

  const weaknesses = base.suggestedFocus.slice(0, 5).map((focus) => `Limited evidence for ${focus}`);

  const atsRecommendations = [
    "Use consistent section headings such as Experience, Education, and Skills",
    "Include measurable outcomes where possible",
    "Keep formatting simple for ATS parsing",
    domain === "design"
      ? "Link to portfolio work with clear project descriptions"
      : "Place key skills near the top of the resume",
  ].slice(0, 7);

  const skillSummary =
    base.detectedSkills.length > 0
      ? ` with skills in ${base.detectedSkills.slice(0, 4).join(", ")}`
      : "";

  const profileSummary = `${base.role} profile at ${base.experienceLevel} level${skillSummary}. Completeness score: ${base.completenessScore}%.`.slice(
    0,
    700,
  );

  const warnings: string[] = [];
  if (base.completenessScore < 60) {
    warnings.push("Several core resume sections appear incomplete or unclear.");
  }

  return {
    strengths: strengths.slice(0, 5),
    weaknesses,
    atsRecommendations,
    profileSummary,
    warnings: warnings.slice(0, 5),
  };
}

type FallbackOptions = {
  includeAiUnavailableWarning?: boolean;
  extractionWarnings?: string[];
};

export function analyzeResumeWithFallback(
  text: string,
  resumeMeta: { filename: string; fileSize: number },
  options: FallbackOptions = {},
): ResumeAnalysisResult {
  const base = analyzeResumeTextMock(text, resumeMeta);
  const enhancements = buildRuleBasedEnhancements(base, text);

  const aiWarnings: string[] = [];
  if (options.includeAiUnavailableWarning) {
    aiWarnings.push(AI_FALLBACK_WARNING);
  }

  const mergedWarnings = [
    ...enhancements.warnings,
    ...(options.extractionWarnings ?? []),
  ].slice(0, 5);

  return {
    role: base.role,
    experienceLevel: base.experienceLevel as ResumeAnalysisResult["experienceLevel"],
    completenessScore: base.completenessScore,
    detectedSkills: base.detectedSkills,
    suggestedFocus: base.suggestedFocus,
    strengths: enhancements.strengths,
    weaknesses: enhancements.weaknesses,
    atsRecommendations: enhancements.atsRecommendations,
    profileSummary: enhancements.profileSummary,
    warnings: mergedWarnings,
    analysisSource: "rule_based",
    aiWarnings,
    resume: base.resume,
  };
}

export { AI_FALLBACK_WARNING };
