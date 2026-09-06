import type { JobEligibilityStatus, OpportunityPriorityBand, OpportunityRecommendation } from "@/generated/prisma/client";

import { clampScore } from "./evidence-coverage";

export function calculatePriorityScore(input: {
  opportunityScore: number;
  freshnessScore: number;
  applicationEffortScore: number;
}): number {
  // Target-company boost is omitted (no such preference system). Remaining weights
  // are 75 / 10 / 10 of 95 and renormalized.
  const totalWeight = 0.75 + 0.1 + 0.1;
  const raw =
    (input.opportunityScore * 0.75 +
      input.freshnessScore * 0.1 +
      input.applicationEffortScore * 0.1) /
    totalWeight;
  return clampScore(raw);
}

export function bandFromPriorityScore(score: number): OpportunityPriorityBand {
  if (score >= 85) return "APPLY_NOW";
  if (score >= 75) return "HIGH_PRIORITY";
  if (score >= 65) return "GOOD_OPPORTUNITY";
  if (score >= 50) return "REVIEW_FIRST";
  return "LOW_PRIORITY";
}

const BAND_RANK: Record<OpportunityPriorityBand, number> = {
  APPLY_NOW: 5,
  HIGH_PRIORITY: 4,
  GOOD_OPPORTUNITY: 3,
  REVIEW_FIRST: 2,
  LOW_PRIORITY: 1,
  SKIP: 0,
};

function minBand(current: OpportunityPriorityBand, cap: OpportunityPriorityBand): OpportunityPriorityBand {
  return BAND_RANK[current] <= BAND_RANK[cap] ? current : cap;
}

export function applyPriorityGuardrails(input: {
  baseBand: OpportunityPriorityBand;
  eligibilityStatus: JobEligibilityStatus;
  hasConfirmedBlocker: boolean;
  alreadyApplied: boolean;
  listingExpired: boolean;
}): { band: OpportunityPriorityBand; recommendation: OpportunityRecommendation } {
  if (input.hasConfirmedBlocker || input.alreadyApplied || input.listingExpired) {
    return { band: "SKIP", recommendation: "SKIP" };
  }

  let band = input.baseBand;
  if (input.eligibilityStatus === "REVIEW_REQUIRED" || input.eligibilityStatus === "LIKELY_INELIGIBLE") {
    band = minBand(band, "REVIEW_FIRST");
  }
  if (input.eligibilityStatus === "INELIGIBLE") {
    return { band: "SKIP", recommendation: "SKIP" };
  }

  const recommendation: OpportunityRecommendation =
    band === "APPLY_NOW" || band === "HIGH_PRIORITY"
      ? "APPLY"
      : band === "GOOD_OPPORTUNITY"
        ? "APPLY_WITH_CAUTION"
        : band === "SKIP"
          ? "SKIP"
          : "REVIEW_FIRST";

  return { band, recommendation };
}
