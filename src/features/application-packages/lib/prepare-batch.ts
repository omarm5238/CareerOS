import { prisma } from "@/server/db/prisma";

import { prepareQueueItem } from "@/features/jobs/queue/lib/prepare-queue-item";

import type { BatchPrepareResult } from "../types";
import { prepareApplicationPackage } from "./prepare-application-package";

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function prepareApplicationPackageBatch(
  userId: string,
  input: { jobPostingIds?: string[]; limit?: number },
): Promise<BatchPrepareResult[]> {
  const limit = Math.min(10, Math.max(1, input.limit ?? 5));
  const explicit = (input.jobPostingIds ?? []).filter((id) => typeof id === "string").slice(0, 10);

  const jobIds: string[] = [...explicit];
  const queueIds = new Map<string, string>();

  if (jobIds.length === 0) {
    const analyses = await prisma.jobOpportunityAnalysis.findMany({
      where: { userId, priorityBand: { in: ["APPLY_NOW", "HIGH_PRIORITY", "GOOD_OPPORTUNITY", "REVIEW_FIRST"] } },
      orderBy: [{ priorityScore: "desc" }, { opportunityScore: "desc" }],
      take: 10,
      select: { jobPostingId: true },
    });
    for (const row of analyses) jobIds.push(row.jobPostingId);

    if (jobIds.length < 10) {
      const queue = await prisma.applicationQueueItem.findMany({
        where: { userId, queueStatus: { in: ["QUEUED", "PREPARING"] } },
        orderBy: { queuedAt: "desc" },
        take: 10 - jobIds.length,
        select: { id: true, jobPostingId: true, discoveredJobId: true },
      });
      for (const item of queue) {
        if (item.jobPostingId) {
          if (!jobIds.includes(item.jobPostingId)) jobIds.push(item.jobPostingId);
          queueIds.set(item.jobPostingId, item.id);
        } else {
          const prepared = await prepareQueueItem(userId, item.id);
          if (prepared.ok) {
            const refreshed = await prisma.applicationQueueItem.findFirst({
              where: { id: item.id, userId },
              select: { jobPostingId: true },
            });
            if (refreshed?.jobPostingId && !jobIds.includes(refreshed.jobPostingId)) {
              jobIds.push(refreshed.jobPostingId);
              queueIds.set(refreshed.jobPostingId, item.id);
            }
          }
        }
      }
    }
  }

  const selected = jobIds.slice(0, limit);
  return mapLimit(selected, 2, async (jobPostingId) => {
    try {
      const result = await prepareApplicationPackage(userId, jobPostingId, {
        queueItemId: queueIds.get(jobPostingId) ?? null,
      });
      return {
        jobPostingId,
        queueItemId: queueIds.get(jobPostingId) ?? null,
        packageId: result.packageId,
        status: result.reused ? "reused" : "prepared",
        error: null,
      };
    } catch (error) {
      return {
        jobPostingId,
        queueItemId: queueIds.get(jobPostingId) ?? null,
        packageId: null,
        status: "failed",
        error: error instanceof Error ? error.message : "Preparation failed.",
      };
    }
  });
}
