import type { CareerMemoryConfidence, CareerMemorySourceType, MemoryCandidate } from "../types";
import { SOURCE_WEIGHTS } from "../types";

export function sourceClassWeight(sourceType: CareerMemorySourceType, evidenceCount: number, uniqueGroups: number): number {
  if (sourceType === "USER_CORRECTED") return SOURCE_WEIGHTS.USER_CORRECTED;
  if (sourceType === "USER_DECLARED") return SOURCE_WEIGHTS.USER_DECLARED;
  if (sourceType === "M21_RESUME" || sourceType === "M22_APPLICATION" || sourceType === "M23_JOBS" || sourceType === "M24_COMMUNICATION" || sourceType === "M25_LINKEDIN") {
    return uniqueGroups >= 2 || evidenceCount >= 2 ? SOURCE_WEIGHTS.DIRECT_DOMAIN_EVENT : SOURCE_WEIGHTS.DIRECT_DOMAIN_EVENT;
  }
  if (sourceType === "M27_WEEKLY") {
    return uniqueGroups >= 2 ? SOURCE_WEIGHTS.REPEATED_WEEKLY_PATTERN : SOURCE_WEIGHTS.SINGLE_DERIVED_SIGNAL;
  }
  if (sourceType === "M26_DAILY") {
    return uniqueGroups >= 2 ? SOURCE_WEIGHTS.REPEATED_DAILY_PATTERN : SOURCE_WEIGHTS.SINGLE_DERIVED_SIGNAL;
  }
  return uniqueGroups >= 2 ? SOURCE_WEIGHTS.REPEATED_WEEKLY_PATTERN : SOURCE_WEIGHTS.SINGLE_DERIVED_SIGNAL;
}

export function bandFromScore(score: number, sourceType: CareerMemorySourceType, contradicted: boolean): CareerMemoryConfidence {
  if (contradicted) return score >= 55 ? "MEDIUM" : "LOW";
  if (sourceType === "USER_CORRECTED" || sourceType === "USER_DECLARED") return "HIGH";
  if (score >= 80) return "HIGH";
  if (score >= 55) return "MEDIUM";
  return "LOW";
}

export function computeConfidenceScore(input: {
  sourceType: CareerMemorySourceType;
  evidence: Array<{ sourceSubsystem: string; observedAt: Date; sourceEventId?: string | null; evidenceType: string }>;
  confirmed: boolean;
  contradicted: boolean;
  now: Date;
}): { score: number; band: CareerMemoryConfidence } {
  const groups = new Set(
    input.evidence.map((item) => item.sourceEventId || `${item.sourceSubsystem}:${item.observedAt.toISOString().slice(0, 10)}`),
  );
  const subsystems = new Set(input.evidence.map((item) => item.sourceSubsystem));
  let score = sourceClassWeight(input.sourceType, input.evidence.length, groups.size);
  score += Math.min(24, Math.max(0, groups.size - 1) * 8);
  score += Math.min(20, Math.max(0, subsystems.size - 1) * 10);
  if (input.confirmed) score += 15;
  if (input.contradicted) score -= 30;
  const latest = input.evidence.reduce((max, item) => (item.observedAt > max ? item.observedAt : max), input.evidence[0]?.observedAt ?? input.now);
  const ageDays = Math.max(0, Math.round((input.now.getTime() - latest.getTime()) / 86_400_000));
  if (input.sourceType === "SYSTEM_DERIVED" || input.sourceType === "M26_DAILY" || input.sourceType === "M27_WEEKLY") {
    score -= Math.min(25, Math.floor(ageDays / 14) * 5);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, band: bandFromScore(score, input.sourceType, input.contradicted) };
}

export function candidateSourceType(candidate: MemoryCandidate): CareerMemorySourceType {
  return candidate.sourceType;
}
