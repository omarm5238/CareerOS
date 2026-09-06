import { prisma } from "@/server/db/prisma";

import { recordApplicationEvent } from "@/features/applications/lib/create-application-event";
import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";

function sanitizeApplyUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function startExternalApplication(userId: string, packageId: string) {
  const row = await prisma.applicationPackage.findFirst({
    where: { id: packageId, userId },
    include: {
      jobPosting: { select: { jobUrl: true } },
      application: { select: { id: true, status: true } },
    },
  });
  if (!row) throw new OpportunityAccessError("NOT_FOUND", "Application package not found.");
  if (row.status !== "APPROVED" && row.status !== "SUBMISSION_STARTED") {
    throw new OpportunityAccessError("CONFLICT", "Approve the package before opening the application.");
  }
  if (!row.applicationId || row.application?.status !== "DRAFT") {
    throw new OpportunityAccessError("CONFLICT", "A draft application is required before opening the external listing.");
  }

  const applyUrl = sanitizeApplyUrl(row.jobPosting?.jobUrl ?? null);
  if (!applyUrl) {
    throw new OpportunityAccessError("INVALID_INPUT", "This job has no safe http(s) apply URL.");
  }

  if (row.status === "SUBMISSION_STARTED") {
    return { applyUrl, packageStatus: row.status, applicationStatus: row.application.status, submitted: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.applicationPackage.update({
      where: { id: row.id },
      data: { status: "SUBMISSION_STARTED", submissionStartedAt: new Date() },
    });
    await recordApplicationEvent(tx, {
      applicationId: row.applicationId!,
      userId,
      type: "OTHER",
      source: "USER",
      title: "External application opened",
      description: "The user opened the external apply URL. CareerOS has not marked this application as submitted.",
    });
  });

  return { applyUrl, packageStatus: "SUBMISSION_STARTED" as const, applicationStatus: "DRAFT" as const, submitted: false };
}

export { sanitizeApplyUrl };
