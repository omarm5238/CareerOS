import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { loadCanonicalProfile } from "@/features/jobs/matching/stamp-job-match";
import { projectCurrentDiscoveryMatch } from "@/features/jobs/matching/project-current-match";
import type { DiscoveryListItem } from "../types";
import { compareDiscoveryRank } from "../quality/search-quality";

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
    where.discoveryStatus = { in: ["CANDIDATE", "DISMISSED", "STALE"] };
  } else {
    where.dismissedAt = null;
    where.discoveryStatus = "CANDIDATE";
  }

  if (filter === "strong") {
    where.finalScore = { gte: minScore };
  } else if (filter === "possible") {
    where.finalScore = { gte: 55, lt: minScore };
    where.hardBlockersJson = { equals: [] };
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
      countryCode: true,
      workMode: true,
      description: true,
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

  const profile = await loadCanonicalProfile(userId);
  const mapped = jobs.map(job => {
    const qi = job.queueItems[0] ?? null;
    const current = projectCurrentDiscoveryMatch({
      title: job.title,
      description: job.description,
      location: job.location,
      countryCode: job.countryCode,
      workMode: job.workMode,
    }, profile);
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      workMode: job.workMode,
      finalScore: current.finalScore,
      scoreBand: current.scoreBand,
      matchSummary: current.matchSummary,
      matchedSkills: safeStringArray(job.matchedSkillsJson),
      missingSkills: safeStringArray(job.missingSkillsJson),
      hardBlockers: current.hardBlockers,
      softBlockers: current.softBlockers,
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

  const visible = mapped.filter((job) => {
    if (filter === "dismissed") return Boolean(job.dismissedAt);
    if (filter === "strong") {
      return !job.dismissedAt && job.hardBlockers.length === 0 && job.scoreBand === "STRONG" && (job.finalScore ?? 0) >= minScore;
    }
    if (filter === "possible") {
      return !job.dismissedAt && job.scoreBand === "POSSIBLE" && job.hardBlockers.length === 0;
    }
    if (job.discoveryStatus === "STALE") return job.hardBlockers.length > 0;
    return true;
  });

  return visible.sort((a, b) => compareDiscoveryRank(toRanked(a), toRanked(b)));
}

function toRanked(job: DiscoveryListItem) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    countryCode: null,
    workMode: job.workMode,
    employmentType: "UNKNOWN",
    description: job.matchSummary ?? job.title,
    postedAt: job.postedAt,
    expiresAt: null,
    sourceUrl: job.sourceUrl ?? "",
    applyUrl: job.sourceUrl,
    provider: job.providers[0] ?? "UNKNOWN",
    externalId: null,
    canonicalScore: job.finalScore,
    eligibility: job.hardBlockers.length > 0
      ? "INELIGIBLE" as const
      : job.softBlockers.includes("REVIEW_REQUIRED")
        ? "REVIEW_REQUIRED" as const
        : "ELIGIBLE" as const,
  };
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
  const [jobs, profile] = await Promise.all([
    prisma.discoveredJob.findMany({
      where: {
        userId,
        discoveryStatus: "CANDIDATE",
        dismissedAt: null,
        lastSeenAt: { gte: todayStart },
      },
      select: {
        title: true,
        description: true,
        location: true,
        countryCode: true,
        workMode: true,
      },
    }),
    loadCanonicalProfile(userId),
  ]);

  return jobs.filter((job) => {
    const current = projectCurrentDiscoveryMatch(job, profile);
    return current.scoreBand === "STRONG" && (current.finalScore ?? 0) >= minimumScore && current.hardBlockers.length === 0;
  }).length;
}
