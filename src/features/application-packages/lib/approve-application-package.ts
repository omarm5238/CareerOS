import { prisma } from "@/server/db/prisma";

import { createApplicationForJob } from "@/features/applications/lib/create-application-for-job";
import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";

import { getApplicationPackageDetail } from "./get-application-package-detail";

export async function approveApplicationPackage(userId: string, packageId: string) {
  const detail = await getApplicationPackageDetail(userId, packageId);
  const row = await prisma.applicationPackage.findFirst({ where: { id: packageId, userId } });
  if (!row) throw new OpportunityAccessError("NOT_FOUND", "Application package not found.");

  if (row.status === "APPROVED" || row.status === "SUBMISSION_STARTED" || row.status === "SUBMITTED") {
    return {
      packageId: row.id,
      status: row.status,
      applicationId: row.applicationId,
      approvedAt: row.approvedAt?.toISOString() ?? null,
    };
  }

  if (detail.jobPostingId) {
    const alreadyAppliedEarly = await prisma.application.findFirst({
      where: {
        userId,
        jobPostingId: detail.jobPostingId,
        status: { in: ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "ACCEPTED"] },
      },
      select: { id: true },
    });
    if (alreadyAppliedEarly) {
      throw new OpportunityAccessError("CONFLICT", "Already applied");
    }
  }

  if (row.status !== "READY_FOR_REVIEW") {
    throw new OpportunityAccessError("CONFLICT", "This package is not waiting for approval.");
  }
  if (detail.stale) {
    throw new OpportunityAccessError("CONFLICT", "Package context changed. Refresh the package before approval.");
  }
  if (detail.readinessStatus !== "READY" || detail.qaStatus !== "PASS") {
    throw new OpportunityAccessError("CONFLICT", "Package is not ready to approve.");
  }
  if (!detail.jobPostingId || !detail.resumeVersionId || !detail.resumeVersionRevisionId) {
    throw new OpportunityAccessError("CONFLICT", "Package is missing job or resume evidence.");
  }
  if (detail.coverLetterRequired && detail.coverLetterStatus !== "READY") {
    throw new OpportunityAccessError("CONFLICT", "Required cover letter is not Ready.");
  }
  if (detail.resumeStatus !== "READY") {
    throw new OpportunityAccessError("CONFLICT", "Resume still needs your approval.");
  }
  if (detail.requiredUserInputs.some((item) => !item.resolved)) {
    throw new OpportunityAccessError("CONFLICT", "Required user inputs still need confirmation.");
  }

  let coverLetterRevisionId: string | null = row.coverLetterRevisionId;
  if (row.coverLetterDraftId) {
    const draft = await prisma.communicationDraft.findFirst({
      where: { id: row.coverLetterDraftId, userId },
      select: { activeRevisionId: true },
    });
    coverLetterRevisionId = draft?.activeRevisionId ?? null;
    if (detail.coverLetterRequired && !coverLetterRevisionId) {
      throw new OpportunityAccessError("CONFLICT", "Required cover letter revision is missing.");
    }
  }

  const created = await createApplicationForJob({
    userId,
    targetJobId: detail.jobPostingId,
    resumeVersionId: detail.resumeVersionId,
    resumeVersionRevisionId: detail.resumeVersionRevisionId,
    source: "JOBS_MODULE",
  });

  const updated = await prisma.applicationPackage.update({
    where: { id: row.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      applicationId: created.applicationId,
      coverLetterRevisionId,
    },
  });

  return {
    packageId: updated.id,
    status: updated.status,
    applicationId: updated.applicationId,
    approvedAt: updated.approvedAt?.toISOString() ?? null,
    reusedExisting: created.reusedExisting,
  };
}
