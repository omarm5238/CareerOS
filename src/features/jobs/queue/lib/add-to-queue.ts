import { prisma } from "@/server/db/prisma";
import { SCORE_BAND_THRESHOLDS } from "../../discovery/constants";

export async function addToQueue(
  userId: string,
  discoveredJobId: string,
): Promise<{ id: string; created: boolean }> {
  const job = await prisma.discoveredJob.findFirst({
    where: { id: discoveredJobId, userId },
    select: { id: true, finalScore: true },
  });

  if (!job) throw new Error("Job not found.");

  const existing = await prisma.applicationQueueItem.findUnique({
    where: { userId_discoveredJobId: { userId, discoveredJobId } },
    select: { id: true },
  });

  if (existing) return { id: existing.id, created: false };

  const priority = (job.finalScore ?? 0) >= SCORE_BAND_THRESHOLDS.EXCELLENT ? "HIGH" : "NORMAL";

  const item = await prisma.applicationQueueItem.create({
    data: {
      userId,
      discoveredJobId,
      priority,
      queueStatus: "QUEUED",
    },
  });

  return { id: item.id, created: true };
}

export async function batchAddToQueue(
  userId: string,
  discoveredJobIds: string[],
  minimumScore: number,
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const id of discoveredJobIds.slice(0, 10)) {
    const job = await prisma.discoveredJob.findFirst({
      where: { id, userId, discoveryStatus: "CANDIDATE", dismissedAt: null },
      select: { id: true, finalScore: true },
    });

    if (!job || (job.finalScore ?? 0) < minimumScore) {
      skipped++;
      continue;
    }

    const result = await addToQueue(userId, id);
    if (result.created) added++;
    else skipped++;
  }

  return { added, skipped };
}
