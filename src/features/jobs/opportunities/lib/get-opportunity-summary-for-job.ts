import { prisma } from "@/server/db/prisma";

import { getOpportunityAnalysisForUser } from "./analyze-job-opportunity";

export async function getOpportunitySummaryForJob(userId: string, jobPostingId: string) {
  const analysis = await getOpportunityAnalysisForUser(userId, jobPostingId);
  if (!analysis) return null;
  const requirements = await prisma.jobRequirement.findMany({
    where: { userId, jobPostingId },
    include: { evidenceMatches: true },
    take: 8,
  });
  return {
    ...analysis,
    topEvidence: requirements
      .flatMap((row) => row.evidenceMatches)
      .filter((match) => match.matchStrength === "DIRECT" || match.matchStrength === "STRONG")
      .slice(0, 3)
      .map((match) => match.evidenceLabel),
    topGaps: analysis.gaps.filter((gap) => gap.severity === "IMPORTANT" || gap.severity === "CRITICAL").slice(0, 3),
  };
}
