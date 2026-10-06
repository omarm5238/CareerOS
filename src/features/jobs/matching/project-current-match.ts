import { evaluateCanonicalMatch, type CanonicalProfile, type CanonicalMatchResult } from "./canonical-match";

export type CurrentMatchJob = {
  title: string;
  description: string;
  location: string | null;
  workMode?: string | null;
  countryCode?: string | null;
};

export type CurrentDiscoveryProjection = {
  finalScore: number | null;
  scoreBand: "STRONG" | "POSSIBLE" | "LOW" | "INELIGIBLE" | null;
  hardBlockers: string[];
  softBlockers: string[];
  matchSummary: string;
  eligibility: CanonicalMatchResult["eligibility"];
};

export function projectCurrentDiscoveryMatch(
  job: CurrentMatchJob,
  profile: CanonicalProfile,
): CurrentDiscoveryProjection {
  const result = evaluateCanonicalMatch(job, profile);
  return {
    finalScore: result.score,
    scoreBand: result.band === "WEAK" ? "LOW" : result.band,
    hardBlockers: result.eligibility === "INELIGIBLE" ? [...result.blockingReasons] : [],
    softBlockers: result.eligibility === "REVIEW_REQUIRED" ? ["REVIEW_REQUIRED", ...result.blockingReasons] : [],
    matchSummary: result.explanation.join(". "),
    eligibility: result.eligibility,
  };
}
