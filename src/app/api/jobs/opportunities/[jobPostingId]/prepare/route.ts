import { NextResponse } from "next/server";

import { handleOpportunityError, readJsonBody, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { loadCanonicalProfile } from "@/features/jobs/matching/stamp-job-match";
import { evaluateCanonicalMatch } from "@/features/jobs/matching/canonical-match";
import { prisma } from "@/server/db/prisma";
import { prepareApplicationPackage } from "@/features/application-packages/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobPostingId: string }> },
) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const { jobPostingId } = await context.params;
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const posting = await prisma.jobPosting.findFirst({
      where: { id: jobPostingId, userId: authResult.userId },
      select: { title: true, description: true, location: true },
    });
    if (!posting) {
      return NextResponse.json({ message: "Job not found." }, { status: 404 });
    }
    const match = evaluateCanonicalMatch(
      { title: posting.title, description: posting.description, location: posting.location },
      await loadCanonicalProfile(authResult.userId),
    );
    if (match.eligibility === "INELIGIBLE") {
      return NextResponse.json({
        message: `Ineligible: ${match.explanation.join(". ")}`,
        blockingReasons: match.blockingReasons,
      }, { status: 409 });
    }
    if (match.eligibility === "REVIEW_REQUIRED" && body.confirmReview !== true) {
      return NextResponse.json({
        message: "This job needs explicit review before preparation.",
        code: "REVIEW_REQUIRED",
        blockingReasons: match.blockingReasons,
      }, { status: 409 });
    }
    const result = await prepareApplicationPackage(authResult.userId, jobPostingId, {
      forceNewPackage: body.forceNewPackage === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleOpportunityError(error);
  }
}
