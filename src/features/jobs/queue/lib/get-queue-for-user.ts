import { prisma } from "@/server/db/prisma";
import type { ApplicationQueueListItem, QueuePreparationState } from "../../discovery/types";

export function derivePreparationState(item: {
  queueStatus: string;
  jobPostingId: string | null;
  resumeVersionId: string | null;
  applicationId: string | null;
  preparationError: string | null;
  resumeStatus?: string | null;
}): QueuePreparationState {
  if (item.applicationId) return "APPLICATION_STARTED";
  if (item.preparationError) return "FAILED";
  if (item.queueStatus === "PREPARING") return "PREPARING";
  if (item.queueStatus === "HANDED_OFF") return "APPLICATION_STARTED";
  if (item.queueStatus === "DISMISSED") return "NOT_PREPARED";
  if (!item.jobPostingId) return "NOT_PREPARED";
  if (!item.resumeVersionId) return "NOT_PREPARED";
  if (item.resumeStatus === "READY") return "READY_TO_APPLY";
  if (item.resumeStatus === "DRAFT") return "NEEDS_RESUME_REVIEW";
  return "NOT_PREPARED";
}

export async function getQueueForUser(userId: string): Promise<ApplicationQueueListItem[]> {
  const items = await prisma.applicationQueueItem.findMany({
    where: { userId, queueStatus: { not: "DISMISSED" } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    include: {
      discoveredJob: {
        select: {
          title: true,
          company: true,
          location: true,
          workMode: true,
          finalScore: true,
          scoreBand: true,
          sources: {
            select: { provider: true, sourceUrl: true },
            take: 3,
          },
        },
      },
    },
  });

  // Batch-load resume statuses
  const resumeIds = items.map(i => i.resumeVersionId).filter((id): id is string => !!id);
  const resumes = resumeIds.length > 0
    ? await prisma.resumeVersion.findMany({
        where: { id: { in: resumeIds } },
        select: { id: true, title: true, status: true },
      })
    : [];
  const resumeMap = new Map(resumes.map(r => [r.id, r]));

  return items.map(item => {
    const dj = item.discoveredJob;
    const rv = item.resumeVersionId ? resumeMap.get(item.resumeVersionId) ?? null : null;
    const prepState = derivePreparationState({
      ...item,
      resumeStatus: rv?.status ?? null,
    });

    return {
      id: item.id,
      discoveredJobId: item.discoveredJobId,
      title: dj.title,
      company: dj.company,
      location: dj.location,
      workMode: dj.workMode,
      discoveryScore: dj.finalScore,
      scoreBand: dj.scoreBand,
      priority: item.priority,
      queueStatus: item.queueStatus,
      preparationState: prepState,
      jobPostingId: item.jobPostingId,
      resumeVersionId: item.resumeVersionId,
      resumeVersionTitle: rv?.title ?? null,
      resumeStatus: rv?.status ?? null,
      applicationId: item.applicationId,
      preparationError: item.preparationError,
      sourceUrl: dj.sources[0]?.sourceUrl ?? null,
      providers: dj.sources.map(s => s.provider),
      queuedAt: item.queuedAt.toISOString(),
    };
  });
}
