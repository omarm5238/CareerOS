import type { ExperienceLevel, OpenAIResumeAnalysisPayload, ResumeAIAnalysisCore } from "./types";

const EXPERIENCE_LEVELS: ExperienceLevel[] = ["Entry / Junior", "Mid-Level", "Senior"];

const LIMITS = {
  detectedSkills: 12,
  suggestedFocus: 5,
  strengths: 5,
  weaknesses: 5,
  atsRecommendations: 7,
  profileSummary: 700,
  warnings: 5,
} as const;

function sanitizeString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function sanitizeStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];

  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    items.push(trimmed);
    if (items.length >= max) break;
  }

  return items;
}

function sanitizeScore(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        return Math.min(100, Math.max(0, parsed));
      }
    }
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function sanitizeExperienceLevel(value: unknown): ExperienceLevel {
  if (typeof value !== "string") return "Entry / Junior";

  const normalized = value.trim();
  if (EXPERIENCE_LEVELS.includes(normalized as ExperienceLevel)) {
    return normalized as ExperienceLevel;
  }

  const lower = normalized.toLowerCase();
  if (lower.includes("senior") || lower.includes("lead") || lower.includes("architect")) {
    return "Senior";
  }

  if (lower.includes("mid")) {
    return "Mid-Level";
  }

  return "Entry / Junior";
}

export function sanitizeResumeAIAnalysis(
  payload: OpenAIResumeAnalysisPayload,
  options: { model?: string; analysisSource: "ai" | "rule_based" },
): ResumeAIAnalysisCore | null {
  const role = sanitizeString(payload.role);
  if (!role) return null;

  const profileSummary = sanitizeString(payload.profileSummary).slice(
    0,
    LIMITS.profileSummary,
  );

  return {
    role,
    experienceLevel: sanitizeExperienceLevel(payload.experienceLevel),
    completenessScore: sanitizeScore(payload.completenessScore),
    detectedSkills: sanitizeStringArray(payload.detectedSkills, LIMITS.detectedSkills),
    suggestedFocus: sanitizeStringArray(payload.suggestedFocus, LIMITS.suggestedFocus),
    strengths: sanitizeStringArray(payload.strengths, LIMITS.strengths),
    weaknesses: sanitizeStringArray(payload.weaknesses, LIMITS.weaknesses),
    atsRecommendations: sanitizeStringArray(
      payload.atsRecommendations,
      LIMITS.atsRecommendations,
    ),
    profileSummary,
    warnings: sanitizeStringArray(payload.warnings, LIMITS.warnings),
    analysisSource: options.analysisSource,
    model: options.model,
  };
}

export function isValidResumeAIAnalysis(result: ResumeAIAnalysisCore): boolean {
  return (
    result.role.length > 0 &&
    result.completenessScore >= 0 &&
    result.completenessScore <= 100 &&
    Array.isArray(result.detectedSkills) &&
    Array.isArray(result.suggestedFocus) &&
    Array.isArray(result.strengths) &&
    Array.isArray(result.weaknesses) &&
    Array.isArray(result.atsRecommendations) &&
    typeof result.profileSummary === "string"
  );
}

export { LIMITS as RESUME_ANALYSIS_LIMITS };
