import { NextResponse } from "next/server";

import { handleOpportunityError, readJsonBody, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { analyzeJobOpportunity } from "@/features/jobs/opportunities/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobPostingId: string }> },
) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const { jobPostingId } = await context.params;
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const analysis = await analyzeJobOpportunity(authResult.userId, jobPostingId, {
      force: body.force === true,
    });
    return NextResponse.json({
      analysisId: analysis.id,
      status: analysis.status,
      opportunityScore: analysis.opportunityScore,
      priorityScore: analysis.priorityScore,
      priorityBand: analysis.priorityBand,
      recommendation: analysis.recommendation,
      evidenceCoverage: analysis.evidenceCoverage,
      eligibilityStatus: analysis.eligibilityStatus,
      applicationEffort: analysis.applicationEffort,
    });
  } catch (error) {
    return handleOpportunityError(error);
  }
}
