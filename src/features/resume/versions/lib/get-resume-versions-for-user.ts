import { prisma } from "@/server/db/prisma";

import type { ResumeVersionListItem } from "../types";

type GetResumeVersionsForUserOptions = {
  includeArchived?: boolean;
};

export async function getResumeVersionsForUser(
  userId: string,
  options: GetResumeVersionsForUserOptions = {},
): Promise<ResumeVersionListItem[]> {
  const includeArchived = options.includeArchived === true;

  const versions = await prisma.resumeVersion.findMany({
    where: {
      userId,
      ...(includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
    include: {
      targetJob: {
        select: {
          id: true,
          title: true,
          company: true,
        },
      },
      activeRevision: {
        select: {
          id: true,
          revisionNumber: true,
        },
      },
    },
  });

  return versions.map((version) => ({
    id: version.id,
    title: version.title,
    type: version.type,
    status: version.status,
    targetJobId: version.targetJobId,
    targetJobTitle: version.targetJob?.title ?? null,
    targetJobCompany: version.targetJob?.company ?? null,
    activeRevisionId: version.activeRevisionId,
    activeRevisionNumber: version.activeRevision?.revisionNumber ?? null,
    alignmentScoreBefore: version.alignmentScoreBefore,
    alignmentScoreAfter: version.alignmentScoreAfter,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
    archivedAt: version.archivedAt?.toISOString() ?? null,
  }));
}
