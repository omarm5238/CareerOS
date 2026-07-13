import { prisma } from "@/server/db/prisma";

import type { WorkspaceJobsStatus } from "../types";

export async function getWorkspaceJobsStatusForUser(
  userId: string,
): Promise<WorkspaceJobsStatus> {
  const [count, latest] = await Promise.all([
    prisma.jobPosting.count({ where: { userId } }),
    prisma.jobPosting.findFirst({
      where: { userId, analysis: { isNot: null } },
      orderBy: { createdAt: "desc" },
      include: { analysis: true },
    }),
  ]);

  return {
    count,
    latestMatchScore: latest?.analysis?.matchScore ?? null,
  };
}
