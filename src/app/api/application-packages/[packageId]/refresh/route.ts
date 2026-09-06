import { NextResponse } from "next/server";

import { handleOpportunityError, requireSessionUserId } from "@/features/application-packages/lib/api-handler";
import { createUpdatedApplicationPackage, getApplicationPackageDetail } from "@/features/application-packages/server";
import { prepareApplicationPackage } from "@/features/application-packages/lib/prepare-application-package";
import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";

export async function POST(
  _request: Request,
  context: { params: Promise<{ packageId: string }> },
) {
  const authResult = await requireSessionUserId();
  if ("error" in authResult) return authResult.error;
  try {
    const { packageId } = await context.params;
    const detail = await getApplicationPackageDetail(authResult.userId, packageId);
    if (!detail.jobPostingId) {
      throw new OpportunityAccessError("CONFLICT", "This package has no job posting.");
    }
    if (detail.status === "APPROVED" || detail.status === "SUBMISSION_STARTED" || detail.status === "SUBMITTED") {
      return NextResponse.json(await createUpdatedApplicationPackage(authResult.userId, packageId));
    }
    return NextResponse.json(await prepareApplicationPackage(authResult.userId, detail.jobPostingId));
  } catch (error) {
    return handleOpportunityError(error);
  }
}
