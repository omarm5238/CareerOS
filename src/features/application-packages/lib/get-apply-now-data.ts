import { prisma } from "@/server/db/prisma";

import type { ApplyNowCard, ApplyNowData } from "../types";

export async function getApplyNowData(userId: string): Promise<ApplyNowData> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [packages, analyses, profile, submittedApplications] = await Promise.all([
    prisma.applicationPackage.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      include: {
        jobPosting: { select: { title: true, company: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.jobOpportunityAnalysis.findMany({
      where: { userId },
      include: { jobPosting: { select: { title: true, company: true } } },
      orderBy: [{ priorityScore: "desc" }, { opportunityScore: "desc" }],
      take: 20,
    }),
    prisma.jobDiscoveryProfile.findUnique({
      where: { userId },
      select: { applicationPreparationMode: true },
    }),
    prisma.application.findMany({
      where: {
        userId,
        status: { in: ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "ACCEPTED"] },
        jobPostingId: { not: null },
      },
      select: { jobPostingId: true },
      take: 200,
    }),
  ]);
  const appliedJobIds = new Set(
    submittedApplications.map((row) => row.jobPostingId).filter((id): id is string => Boolean(id)),
  );

  const cards: ApplyNowCard[] = [];
  const seenJobs = new Set<string>();

  for (const row of packages) {
    const snapshot = (row.opportunitySnapshotJson ?? {}) as Record<string, unknown>;
    const gaps = Array.isArray(row.gapSnapshotJson) ? row.gapSnapshotJson : [];
    const mainGap = gaps.find((item) => {
      const record = item as Record<string, unknown>;
      return record.severity === "IMPORTANT" || record.severity === "CRITICAL";
    }) as Record<string, unknown> | undefined;
    cards.push({
      packageId: row.id,
      jobPostingId: row.jobPostingId,
      queueItemId: row.applicationQueueItemId,
      title: row.jobPosting?.title ?? "Saved job",
      company: row.jobPosting?.company ?? "Unknown company",
      priorityBand: (snapshot.priorityBand as ApplyNowCard["priorityBand"]) ?? null,
      opportunityScore: typeof snapshot.opportunityScore === "number" ? snapshot.opportunityScore : null,
      evidenceCoverage: typeof snapshot.evidenceCoverage === "number" ? snapshot.evidenceCoverage : null,
      mainGap: typeof mainGap?.requirementName === "string" ? mainGap.requirementName : null,
      freshnessLabel: null,
      applicationEffort: (snapshot.applicationEffort as ApplyNowCard["applicationEffort"]) ?? null,
      readinessStatus: row.readinessStatus,
      packageStatus: row.status,
      alreadyApplied: row.status === "SUBMITTED" || Boolean(row.jobPostingId && appliedJobIds.has(row.jobPostingId)),
    });
    if (row.jobPostingId) seenJobs.add(row.jobPostingId);
  }

  for (const analysis of analyses) {
    if (seenJobs.has(analysis.jobPostingId)) continue;
    cards.push({
      packageId: null,
      jobPostingId: analysis.jobPostingId,
      queueItemId: null,
      title: analysis.jobPosting.title,
      company: analysis.jobPosting.company,
      priorityBand: analysis.priorityBand,
      opportunityScore: analysis.opportunityScore,
      evidenceCoverage: analysis.evidenceCoverage,
      mainGap: null,
      freshnessLabel: null,
      applicationEffort: analysis.applicationEffort,
      readinessStatus: null,
      packageStatus: null,
      alreadyApplied: appliedJobIds.has(analysis.jobPostingId),
    });
  }

  const rank: Record<string, number> = {
    APPLY_NOW: 6,
    HIGH_PRIORITY: 5,
    GOOD_OPPORTUNITY: 4,
    REVIEW_FIRST: 3,
    LOW_PRIORITY: 2,
    SKIP: 1,
  };
  cards.sort((a, b) => {
    const readyDelta =
      Number(a.readinessStatus === "READY") - Number(b.readinessStatus === "READY");
    if (readyDelta !== 0) return -readyDelta;
    return (rank[b.priorityBand ?? ""] ?? 0) - (rank[a.priorityBand ?? ""] ?? 0);
  });

  return {
    counts: {
      readyToReview: packages.filter((row) => row.readinessStatus === "READY" && row.status === "READY_FOR_REVIEW").length,
      needsInput: packages.filter((row) => row.readinessStatus === "NEEDS_REVIEW").length,
      highPriority: analyses.filter((row) =>
        row.priorityBand === "APPLY_NOW" || row.priorityBand === "HIGH_PRIORITY",
      ).length,
      preparedToday: packages.filter((row) => row.preparedAt && row.preparedAt >= startOfDay).length,
    },
    preparationMode: profile?.applicationPreparationMode ?? "ASSISTED",
    cards: cards.slice(0, 30),
  };
}
