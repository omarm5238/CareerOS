import { getCurrentResumeContextForUser } from "@/features/resume/server";
import { getDiscoveryProfileForUser } from "@/features/jobs/discovery/lib/get-discovery-profile";

import type { JobMatchAnalysis, RoleAlignment } from "../types";
import { evaluateCanonicalMatch, type CanonicalJobInput, type CanonicalMatchResult, type CanonicalProfile } from "./canonical-match";

export async function loadCanonicalProfile(userId: string) {
  const [profile, resumeContext] = await Promise.all([
    getDiscoveryProfileForUser(userId),
    getCurrentResumeContextForUser(userId),
  ]);
  const resume = resumeContext.status === "CURRENT" ? resumeContext.analysis : null;
  const skills = resume?.detectedSkills ?? [];
  const locations = (profile?.locationTargets ?? []).filter((target) => target.enabled);
  return {
    roleTargets: (profile?.roleTargets ?? []).filter((target) => target.enabled).map((target) => target.title),
    experienceLevel: resume?.experienceLevel ?? profile?.experienceLevels?.[0] ?? null,
    skills,
    evidenceSkills: skills,
    countryCode: locations[0]?.countryCode ?? null,
    countryNames: locations.flatMap((target) => [target.country, ...target.cities]),
    workModes: profile?.workModes ?? [],
  };
}

export function canonicalMarker(result: CanonicalMatchResult): string {
  return `CANONICAL|${result.eligibility}|${result.band}|${result.score ?? ""}|${result.blockingReasons.join(",")}`;
}

export function applyCanonicalResultToJobMatch(
  analysis: JobMatchAnalysis,
  result: CanonicalMatchResult,
): JobMatchAnalysis {
  const roleAlignment: RoleAlignment = result.band === "STRONG"
    ? "Strong"
    : result.band === "POSSIBLE"
      ? "Partial"
      : result.band === "INELIGIBLE"
        ? "Weak"
        : "Weak";
  return {
    ...analysis,
    matchScore: result.score ?? 0,
    roleAlignment,
    aiWarnings: [
      canonicalMarker(result),
      ...analysis.aiWarnings.filter((warning) => !warning.startsWith("CANONICAL|")),
    ],
    fitSummary: result.eligibility === "INELIGIBLE"
      ? result.explanation.join(". ")
      : analysis.fitSummary ?? result.explanation.join(". "),
    recommendations: result.eligibility === "INELIGIBLE"
      ? analysis.recommendations.filter((item) => !/strong match/i.test(item))
      : analysis.recommendations,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function projectSavedJobAnalysis<T extends {
  title: string;
  description: string;
  location: string | null;
  analysis: {
    matchScore: number;
    roleAlignment: string;
    matchedSkills: unknown;
    missingSkills: unknown;
    resumeSignals: unknown;
    jobSignals: unknown;
    recommendations: unknown;
    fitSummary?: string | null;
    applicationStrategy?: unknown;
    resumeTailoringTips?: unknown;
    aiWarnings?: unknown;
  } | null;
}>(job: T, profile: CanonicalProfile): T {
  if (!job.analysis) return job;
  const alignment = job.analysis.roleAlignment;
  const current = applyCanonicalResultToJobMatch({
    matchScore: job.analysis.matchScore,
    roleAlignment: alignment === "Strong" || alignment === "Partial" || alignment === "Weak" || alignment === "Unknown" ? alignment : "Unknown",
    matchedSkills: stringList(job.analysis.matchedSkills),
    missingSkills: stringList(job.analysis.missingSkills),
    resumeSignals: stringList(job.analysis.resumeSignals),
    jobSignals: stringList(job.analysis.jobSignals),
    recommendations: stringList(job.analysis.recommendations),
    analysisSource: "ai",
    aiModel: null,
    fitSummary: job.analysis.fitSummary ?? null,
    applicationStrategy: stringList(job.analysis.applicationStrategy),
    resumeTailoringTips: stringList(job.analysis.resumeTailoringTips),
    aiWarnings: stringList(job.analysis.aiWarnings),
  }, evaluateCanonicalMatch({
    title: job.title,
    description: job.description,
    location: job.location,
  }, profile));
  return {
    ...job,
    analysis: {
      ...job.analysis,
      matchScore: current.matchScore,
      roleAlignment: current.roleAlignment,
      fitSummary: current.fitSummary,
      aiWarnings: current.aiWarnings,
      recommendations: current.recommendations,
    },
  };
}

export async function stampCanonicalJobMatch(
  userId: string,
  job: CanonicalJobInput,
  analysis: JobMatchAnalysis,
): Promise<JobMatchAnalysis> {
  const profile = await loadCanonicalProfile(userId);
  return applyCanonicalResultToJobMatch(analysis, evaluateCanonicalMatch(job, profile));
}
