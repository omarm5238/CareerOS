import type { JobEvidenceMatchStrength } from "@/generated/prisma/client";

import type { GapRecommendedAction, GapSeverity, JobGap, JobRequirementInput } from "../types";

export function analyzeJobGaps(
  requirements: Array<JobRequirementInput & { bestStrength: JobEvidenceMatchStrength }>,
): JobGap[] {
  const gaps: JobGap[] = [];

  for (const requirement of requirements) {
    if (requirement.bestStrength === "DIRECT" || requirement.bestStrength === "STRONG") continue;

    const legal =
      requirement.category === "AUTHORIZATION" || requirement.category === "SECURITY_CLEARANCE";

    let severity: GapSeverity = "OPTIONAL";
    let recommendedAction: GapRecommendedAction = "IGNORE";
    let explanation = `${requirement.normalizedName} is not fully evidenced.`;

    if (requirement.bestStrength === "TRANSFERABLE") {
      severity = requirement.importance === "REQUIRED" ? "IMPORTANT" : "MINOR";
      recommendedAction = "EMPHASIZE_TRANSFERABLE_EVIDENCE";
      explanation = `Use transferable evidence. Do not claim ${requirement.normalizedName} proficiency.`;
    } else if (requirement.bestStrength === "PARTIAL") {
      severity = requirement.importance === "REQUIRED" ? "IMPORTANT" : "MINOR";
      recommendedAction = "ADDRESS_IN_RESUME";
      explanation = `Partial evidence exists for ${requirement.normalizedName}.`;
    } else if (requirement.bestStrength === "NONE") {
      if (legal && requirement.importance === "REQUIRED") {
        severity = "IMPORTANT";
        recommendedAction = "USER_REVIEW";
        explanation = `${requirement.normalizedName} is mentioned. CareerOS does not have a confirmed user fact, so this needs review rather than a legal decision.`;
      } else if (requirement.importance === "REQUIRED") {
        severity = "IMPORTANT";
        recommendedAction = "APPLY_ANYWAY";
        explanation = `${requirement.normalizedName} is required but not evidenced. A missing skill alone is not a blocker.`;
      } else if (requirement.importance === "OPTIONAL" || requirement.importance === "UNKNOWN") {
        severity = "OPTIONAL";
        recommendedAction = "LEARN_LATER";
        explanation = `${requirement.normalizedName} is not required.`;
      } else {
        severity = "MINOR";
        recommendedAction = "LEARN_LATER";
        explanation = `${requirement.normalizedName} is preferred but not evidenced.`;
      }
    }

    gaps.push({
      requirementName: requirement.normalizedName,
      category: requirement.category,
      importance: requirement.importance,
      matchStrength: requirement.bestStrength,
      severity,
      recommendedAction,
      explanation,
    });
  }

  return gaps;
}

export function countGaps(gaps: JobGap[]) {
  return {
    criticalGapCount: gaps.filter((gap) => gap.severity === "CRITICAL").length,
    importantGapCount: gaps.filter((gap) => gap.severity === "IMPORTANT").length,
    minorGapCount: gaps.filter((gap) => gap.severity === "MINOR").length,
    optionalGapCount: gaps.filter((gap) => gap.severity === "OPTIONAL").length,
  };
}
