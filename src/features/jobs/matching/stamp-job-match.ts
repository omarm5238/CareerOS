import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { getDiscoveryProfileForUser } from "@/features/jobs/discovery/lib/get-discovery-profile";

import type { JobMatchAnalysis, RoleAlignment } from "../types";
import { evaluateCanonicalMatch, type CanonicalJobInput, type CanonicalMatchResult } from "./canonical-match";

export async function loadCanonicalProfile(userId: string) {
  const [profile, resume] = await Promise.all([
    getDiscoveryProfileForUser(userId),
    getLatestResumeAnalysisForUser(userId),
  ]);
  const skills = Array.isArray(resume?.detectedSkills)
    ? resume.detectedSkills.filter((skill): skill is string => typeof skill === "string")
    : [];
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
