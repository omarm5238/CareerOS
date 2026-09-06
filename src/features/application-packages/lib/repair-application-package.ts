import { prisma } from "@/server/db/prisma";

import { regenerateCommunication } from "@/features/communications/lib/regenerate-communication";
import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";

import { parseQaSnapshot, toPrismaJson } from "./json-parsers";
import { prepareApplicationPackage } from "./prepare-application-package";

export async function repairApplicationPackage(userId: string, packageId: string) {
  const row = await prisma.applicationPackage.findFirst({ where: { id: packageId, userId } });
  if (!row) throw new OpportunityAccessError("NOT_FOUND", "Application package not found.");
  if (row.qaStatus !== "NEEDS_REPAIR") {
    throw new OpportunityAccessError("CONFLICT", "Repair is only available when package QA needs repair.");
  }

  const qa = parseQaSnapshot(row.qaSnapshotJson);
  if (qa.repairAttempted >= 2) {
    throw new OpportunityAccessError("CONFLICT", "Maximum safe repair attempts reached.");
  }

  if (row.coverLetterDraftId) {
    await regenerateCommunication(userId, row.coverLetterDraftId);
  }

  qa.repairAttempted += 1;
  await prisma.applicationPackage.update({
    where: { id: row.id },
    data: { qaSnapshotJson: toPrismaJson(qa) },
  });

  if (!row.jobPostingId) {
    throw new OpportunityAccessError("CONFLICT", "This package has no job posting to rebuild.");
  }

  return prepareApplicationPackage(userId, row.jobPostingId, { forceNewPackage: false });
}
