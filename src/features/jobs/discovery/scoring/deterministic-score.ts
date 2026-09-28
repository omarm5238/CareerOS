import type { JobDiscoveryRoleTarget, JobDiscoveryLocationTarget, DiscoveryScoreBreakdown } from "../types";
import { evaluateCanonicalMatch, type CanonicalMatchResult } from "@/features/jobs/matching/canonical-match";

export interface DeterministicScoreInput {
  jobTitle: string;
  jobDescription: string;
  jobLocation: string | null;
  jobCountryCode: string | null;
  jobWorkMode: string;
  jobEmploymentType: string;
  jobPostedAt: string | null;
  roleTargets: JobDiscoveryRoleTarget[];
  locationTargets: JobDiscoveryLocationTarget[];
  userWorkModes: string[];
  userEmploymentTypes: string[];
  userExperienceLevel: string | null;
  userSkills: string[];
  userEvidenceSkills: string[];
  freshnessDays: number;
}

export interface DeterministicScoreResult {
  breakdown: DiscoveryScoreBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  hardBlockers: string[];
  softBlockers: string[];
  evidence: string[];
  scoreBand: string;
  canonical: CanonicalMatchResult;
}

export function calculateDeterministicScore(input: DeterministicScoreInput): DeterministicScoreResult {
  const enabledLocations = input.locationTargets.filter((target) => target.enabled);
  const canonical = evaluateCanonicalMatch(
    {
      title: input.jobTitle,
      description: input.jobDescription,
      location: input.jobLocation,
      countryCode: input.jobCountryCode,
      workMode: input.jobWorkMode,
    },
    {
      roleTargets: input.roleTargets.filter((target) => target.enabled).map((target) => target.title),
      experienceLevel: input.userExperienceLevel,
      skills: input.userSkills,
      evidenceSkills: input.userEvidenceSkills,
      countryCode: enabledLocations[0]?.countryCode ?? null,
      countryNames: enabledLocations.flatMap((target) => [target.country, ...target.cities]),
      workModes: input.userWorkModes,
    },
  );

  const components = canonical.components;
  const total = canonical.score ?? 0;
  const hardBlockers = canonical.eligibility === "INELIGIBLE" ? canonical.blockingReasons : [];
  const softBlockers = canonical.eligibility === "REVIEW_REQUIRED"
    ? ["REVIEW_REQUIRED", ...canonical.blockingReasons]
    : [];

  return {
    breakdown: {
      roleAlignment: Math.round(components.roleAlignment * 0.25),
      skillsOverlap: Math.round(components.stackMatch * 0.25),
      experienceSeniority: Math.round(components.seniorityFit * 0.15),
      evidenceStrength: Math.round(components.evidenceStrength * 0.15),
      locationWorkMode: Math.round(components.locationFit * 0.1),
      freshness: Math.round(components.experienceAlignment * 0.05),
      employmentType: Math.round(components.dataConfidence * 0.05),
      total,
    },
    matchedSkills: [],
    missingSkills: canonical.gaps,
    hardBlockers,
    softBlockers,
    evidence: canonical.explanation,
    scoreBand: canonical.band === "WEAK" ? "LOW" : canonical.band,
    canonical,
  };
}
