import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";
import { prisma } from "@/server/db/prisma";

import { prepareApplicationPackage } from "./prepare-application-package";

export async function createUpdatedApplicationPackage(userId: string, packageId: string) {
  const row = await prisma.applicationPackage.findFirst({ where: { id: packageId, userId } });
  if (!row) throw new OpportunityAccessError("NOT_FOUND", "Application package not found.");
  if (!row.jobPostingId) {
    throw new OpportunityAccessError("CONFLICT", "This package has no job posting.");
  }
  return prepareApplicationPackage(userId, row.jobPostingId, {
    forceNewPackage: true,
    queueItemId: row.applicationQueueItemId,
  });
}
