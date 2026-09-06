import { prisma } from "@/server/db/prisma";

import { dismissDiscoveredJob } from "@/features/jobs/discovery/lib/dismiss-discovered-job";
import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";

export async function skipOpportunity(userId: string, input: { packageId?: string; jobPostingId?: string }) {
  if (input.packageId) {
    const row = await prisma.applicationPackage.findFirst({ where: { id: input.packageId, userId } });
    if (!row) throw new OpportunityAccessError("NOT_FOUND", "Application package not found.");
    await prisma.applicationPackage.update({
      where: { id: row.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
  }

  const jobPostingId = input.jobPostingId;
  if (jobPostingId) {
    const discovered = await prisma.discoveredJob.findFirst({
      where: { userId, jobPostingId },
      select: { id: true },
    });
    if (discovered) {
      await dismissDiscoveredJob(userId, discovered.id, "Skipped from Apply Now");
    }
  }

  return { skipped: true };
}
