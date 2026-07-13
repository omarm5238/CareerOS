import { prisma } from "@/server/db/prisma";

import type { WorkspaceJobsStatus } from "../types";

export async function getWorkspaceJobsStatusForUser(
  userId: string,
): Promise<WorkspaceJobsStatus> {
  const [count, appliedCount, latest] = await Promise.all([
    prisma.jobPosting.count({ where: { userId } }),
    prisma.jobPosting.count({ where: { userId, applicationStatus: "applied" } }),
    prisma.jobPosting.findFirst({
      where: { userId, analysis: { isNot: null } },
      orderBy: { createdAt: "desc" },
      include: { analysis: true },
    }),
  ]);

  return {
    count,
    appliedCount,
    latestMatchScore: latest?.analysis?.matchScore ?? null,
  };
}
