import { prisma } from "@/server/db/prisma";

/**
 * Returns the most relevant non-archived resume version for a target job.
 * Preference: READY > USED > DRAFT, then newest updatedAt.
 */
export async function getResumeVersionForJob(userId: string, targetJobId: string) {
  const versions = await prisma.resumeVersion.findMany({
    where: {
      userId,
      targetJobId,
      status: { not: "ARCHIVED" },
    },
    include: {
      activeRevision: {
        select: {
          id: true,
          revisionNumber: true,
          source: true,
          generationStatus: true,
          alignmentScoreAfter: true,
          createdAt: true,
        },
      },
      targetJob: {
        select: {
          id: true,
          title: true,
          company: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (versions.length === 0) {
    return null;
  }

  const statusRank: Record<string, number> = {
    READY: 0,
    USED: 1,
    DRAFT: 2,
  };

  const sorted = [...versions].sort((a, b) => {
    const rankA = statusRank[a.status] ?? 99;
    const rankB = statusRank[b.status] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return sorted[0] ?? null;
}
