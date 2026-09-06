import { NextResponse } from "next/server";

import { handleOpportunityError, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { getApplicationPackageDetail } from "@/features/application-packages/server";
import { prisma } from "@/server/db/prisma";
import { runApplicationPackageQa } from "@/features/application-packages/lib/run-application-package-qa";
import { toPrismaJson } from "@/features/application-packages/lib/json-parsers";

export async function POST(
  _request: Request,
  context: { params: Promise<{ packageId: string }> },
) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const { packageId } = await context.params;
    const detail = await getApplicationPackageDetail(authResult.userId, packageId);
    const qa = runApplicationPackageQa({
      jobTitle: detail.jobTitle,
      company: detail.company,
      jobPostingId: detail.jobPostingId,
      resumeVersionId: detail.resumeVersionId,
      resumeVersionRevisionId: detail.resumeVersionRevisionId,
      resumeBelongsToJob: Boolean(detail.resumeVersionId),
      resumeReady: detail.resumeStatus === "READY",
      coverLetterRequired: detail.coverLetterRequired,
      coverLetterReady: detail.coverLetterStatus === "READY",
      coverLetterJobId: detail.jobPostingId,
      coverLetterHasUnsupportedClaim: false,
      requiredInputs: detail.requiredUserInputs,
      alreadyApplied: detail.status === "SUBMITTED",
      listingExpired: false,
      stale: detail.stale,
    });
    await prisma.applicationPackage.update({
      where: { id: packageId },
      data: { qaStatus: qa.status, qaSnapshotJson: toPrismaJson(qa) },
    });
    return NextResponse.json({ qaStatus: qa.status, checks: qa.checks });
  } catch (error) {
    return handleOpportunityError(error);
  }
}
