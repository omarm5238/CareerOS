import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { DiscoveryListItem } from "../types";

export async function getDiscoveryResultsForUser(
  userId: string,
  options?: {
    filter?: "strong" | "possible" | "all" | "dismissed";
    minimumScore?: number;
  },
): Promise<DiscoveryListItem[]> {
  const filter = options?.filter ?? "all";
  const minScore = options?.minimumScore ?? 75;

  const where: Prisma.discoveredJobWhereInput = { userId };

  if (filter === "dismissed") {
    where.dismissedAt = { not: null };
  } else if (filter === "all") {
    // Include dismissed rows so the client dismissed tab survives refresh.
    where.discoveryStatus = { in: ["CANDIDATE", "DISMISSED"] };
  } else {
    where.dismissedAt = null;
    where.discoveryStatus = "CANDIDATE";
  }

  if (filter === "strong") {
    where.finalScore = { gte: minScore };
  } else if (filter === "possible") {
    where.finalScore = { gte: 65, lt: minScore };
  }

  const jobs = await prisma.discoveredJob.findMany({
    where,
    orderBy: { finalScore: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      workMode: true,
      finalScore: true,
      scoreBand: true,
      matchSummary: true,
      matchedSkillsJson: true,
      missingSkillsJson: true,
      hardBlockersJson: true,
      softBlockersJson: true,
      evidenceJson: true,
      warningsJson: true,
      analysisSource: true,
      discoveryStatus: true,
      postedAt: true,
      dismissedAt: true,
      jobPostingId: true,
      sources: {
        select: {
          provider: true,
          sourceUrl: true,
          applyUrl: true,
        },
      },
      queueItems: {
        where: { userId },
        select: { id: true, queueStatus: true, applicationId: true },
        take: 1,
      },
    },
  });

  return jobs.map(job => {
    const qi = job.queueItems[0] ?? null;
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      workMode: job.workMode,
      finalScore: job.finalScore,
      scoreBand: job.scoreBand,
      matchSummary: job.matchSummary,
      matchedSkills: safeStringArray(job.matchedSkillsJson),
      missingSkills: safeStringArray(job.missingSkillsJson),
      hardBlockers: safeStringArray(job.hardBlockersJson),
      softBlockers: safeStringArray(job.softBlockersJson),
      evidence: safeStringArray(job.evidenceJson),
      warnings: safeStringArray(job.warningsJson),
      analysisSource: job.analysisSource,
      discoveryStatus: job.discoveryStatus,
      postedAt: job.postedAt?.toISOString() ?? null,
      providers: job.sources.map(s => s.provider),
      sourceUrl: job.sources[0]?.sourceUrl ?? null,
      dismissedAt: job.dismissedAt?.toISOString() ?? null,
      jobPostingId: job.jobPostingId,
      queueItemId: qi?.id ?? null,
      queueStatus: qi?.queueStatus ?? null,
      applicationId: qi?.applicationId ?? null,
    };
  });
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function getLastDiscoveryRun(userId: string) {
  return prisma.jobDiscoveryRun.findFirst({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });
}

export async function getTodayStrongCount(userId: string, minimumScore: number): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return prisma.discoveredJob.count({
    where: {
      userId,
      discoveryStatus: "CANDIDATE",
      finalScore: { gte: minimumScore },
      dismissedAt: null,
      lastSeenAt: { gte: todayStart },
    },
  });
}
