import { prisma } from "@/server/db/prisma";
import { projectCurrentDiscoveryMatch } from "@/features/jobs/matching/project-current-match";
import { loadCanonicalProfile } from "@/features/jobs/matching/stamp-job-match";
import { SCORE_BAND_THRESHOLDS } from "../../discovery/constants";

const discoveredMatchSelect = {
  id: true,
  title: true,
  description: true,
  location: true,
  countryCode: true,
  workMode: true,
  finalScore: true,
} as const;

export async function addToQueue(
  userId: string,
  discoveredJobId: string,
): Promise<{ id: string; created: boolean }> {
  const job = await prisma.discoveredJob.findFirst({
    where: { id: discoveredJobId, userId },
    select: discoveredMatchSelect,
  });

  if (!job) throw new Error("Job not found.");
  const current = projectCurrentDiscoveryMatch(job, await loadCanonicalProfile(userId));
  if (current.eligibility === "INELIGIBLE") {
    throw new Error("This job is ineligible and cannot enter the application queue.");
  }

  const existing = await prisma.applicationQueueItem.findUnique({
    where: { userId_discoveredJobId: { userId, discoveredJobId } },
    select: { id: true },
  });

  if (existing) return { id: existing.id, created: false };

  const priority = (current.finalScore ?? 0) >= SCORE_BAND_THRESHOLDS.EXCELLENT ? "HIGH" : "NORMAL";

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

  const profile = await loadCanonicalProfile(userId);
  for (const id of discoveredJobIds.slice(0, 10)) {
    const job = await prisma.discoveredJob.findFirst({
      where: { id, userId, discoveryStatus: "CANDIDATE", dismissedAt: null },
      select: discoveredMatchSelect,
    });
    const current = job ? projectCurrentDiscoveryMatch(job, profile) : null;
    if (!current || current.eligibility !== "ELIGIBLE" || current.scoreBand == null || current.scoreBand === "INELIGIBLE" || (current.finalScore ?? 0) < minimumScore) {
      skipped++;
      continue;
    }

    const result = await addToQueue(userId, id);
    if (result.created) added++;
    else skipped++;
  }

  return { added, skipped };
}
