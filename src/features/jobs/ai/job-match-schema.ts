import type { RoleAlignment } from "../types";
import type { JobMatchAIAnalysisPayload, JobMatchAnalysisResult } from "./types";

const ROLE_ALIGNMENTS: RoleAlignment[] = ["Strong", "Partial", "Weak", "Unknown"];

const LIMITS = {
  matchedSkills: 12,
  missingSkills: 12,
  resumeSignals: 8,
  jobSignals: 8,
  recommendations: 8,
  applicationStrategy: 6,
  resumeTailoringTips: 6,
  warnings: 6,
  fitSummary: 700,
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
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return Math.min(100, Math.max(0, parsed));
    }
  }

  return 0;
}

function sanitizeRoleAlignment(value: unknown): RoleAlignment {
  if (typeof value !== "string") return "Unknown";
  const normalized = value.trim();
  if (ROLE_ALIGNMENTS.includes(normalized as RoleAlignment)) {
    return normalized as RoleAlignment;
  }
  return "Unknown";
}

export function sanitizeJobMatchAIAnalysis(
  payload: JobMatchAIAnalysisPayload,
  model: string,
): JobMatchAnalysisResult | null {
  const matchScore = sanitizeScore(payload.matchScore);
  const roleAlignment = sanitizeRoleAlignment(payload.roleAlignment);
  const matchedSkills = sanitizeStringArray(payload.matchedSkills, LIMITS.matchedSkills);
  const missingSkills = sanitizeStringArray(payload.missingSkills, LIMITS.missingSkills);
  const resumeSignals = sanitizeStringArray(payload.resumeSignals, LIMITS.resumeSignals);
  const jobSignals = sanitizeStringArray(payload.jobSignals, LIMITS.jobSignals);
  const recommendations = sanitizeStringArray(payload.recommendations, LIMITS.recommendations);
  const fitSummary = sanitizeString(payload.fitSummary).slice(0, LIMITS.fitSummary);
  const applicationStrategy = sanitizeStringArray(
    payload.applicationStrategy,
    LIMITS.applicationStrategy,
  );
  const resumeTailoringTips = sanitizeStringArray(
    payload.resumeTailoringTips,
    LIMITS.resumeTailoringTips,
  );
  const warnings = sanitizeStringArray(payload.warnings, LIMITS.warnings);

  if (matchScore === 0 && matchedSkills.length === 0 && !fitSummary) {
    return null;
  }

  return {
    matchScore,
    roleAlignment,
    matchedSkills,
    missingSkills,
    resumeSignals,
    jobSignals,
    recommendations,
    analysisSource: "ai",
    aiModel: model,
    fitSummary: fitSummary || null,
    applicationStrategy,
    resumeTailoringTips,
    aiWarnings: warnings,
  };
}

export function isValidJobMatchAIAnalysis(result: JobMatchAnalysisResult): boolean {
  return (
    result.matchScore >= 0 &&
    result.matchScore <= 100 &&
    ROLE_ALIGNMENTS.includes(result.roleAlignment)
  );
}
