import { prisma } from "@/server/db/prisma";

import { getCareerLocalDate } from "@/features/daily-roadmap/lib/timezone";
import { getPreviousWeekStartLocalDate } from "../period/week-bounds";
import { MAX_HANDOFF_CANDIDATES } from "../types";

const CLOSED_APPLICATION = ["ACCEPTED", "REJECTED", "WITHDRAWN"] as const;

export type WeeklyHandoffCandidate = {
  type: string;
  origin: "SYSTEM_RECOMMENDED";
  sourceEntityType: "APPLICATION" | "JOB" | "COMMUNICATION" | "LINKEDIN_POST" | "SKILL" | "CAREER_CONTEXT" | "NONE";
  sourceEntityId: string | null;
  intent: string;
  title: string;
  whyNowFacts: string[];
  deepLink: string;
  category: "follow_up" | "jobs" | "linkedin" | "skills" | "setup";
  estimatedMinutes: 15 | 30;
};

export async function loadAdoptedWeeklyHandoffCandidates(input: {
  userId: string;
  timezone: string;
  now?: Date;
}): Promise<WeeklyHandoffCandidate[]> {
  const now = input.now ?? new Date();
  const today = getCareerLocalDate(now, input.timezone);
  const { getCareerWeekBounds } = await import("../period/week-bounds");
  const currentWeekStart = getCareerWeekBounds(today, input.timezone).weekStartLocalDate;
  const previousWeekStart = getPreviousWeekStartLocalDate(currentWeekStart);

  const previous = await prisma.weeklyCareerReview.findUnique({
    where: { userId_weekStartLocalDate: { userId: input.userId, weekStartLocalDate: previousWeekStart } },
    include: {
      recommendations: {
        where: { status: "ADOPTED" },
        orderBy: { adoptedAt: "asc" },
      },
    },
  });
  if (!previous) return [];

  const adopted = previous.recommendations.slice(0, MAX_HANDOFF_CANDIDATES);
  const results: WeeklyHandoffCandidate[] = [];

  for (const rec of adopted) {
    if (rec.recommendedActionType === "APPLICATION_FOLLOW_UP") {
      const due = await prisma.application.findFirst({
        where: {
          userId: input.userId,
          status: { notIn: [...CLOSED_APPLICATION] },
          followUpAt: { not: null },
        },
        orderBy: { followUpAt: "asc" },
      });
      if (!due) continue;
      results.push({
        type: "APPLICATION_FOLLOW_UP",
        origin: "SYSTEM_RECOMMENDED",
        sourceEntityType: "APPLICATION",
        sourceEntityId: due.id,
        intent: `weekly-handoff:${rec.fingerprint}`,
        title: rec.title,
        whyNowFacts: [rec.reason, "Adopted from last week's review."],
        deepLink: `/workspace/applications/${due.id}`,
        category: "follow_up",
        estimatedMinutes: 15,
      });
      continue;
    }

    if (rec.recommendedActionType === "JOB_PREPARE" || rec.recommendedActionType === "JOB_APPLY") {
      const queueItem = await prisma.applicationQueueItem.findFirst({
        where: {
          userId: input.userId,
          queueStatus: { in: ["QUEUED", "PREPARING"] },
        },
        include: { discoveredJob: true },
        orderBy: { createdAt: "desc" },
      });
      if (!queueItem) continue;
      results.push({
        type: rec.recommendedActionType,
        origin: "SYSTEM_RECOMMENDED",
        sourceEntityType: "JOB",
        sourceEntityId: queueItem.discoveredJobId,
        intent: `weekly-handoff:${rec.fingerprint}`,
        title: rec.title,
        whyNowFacts: [rec.reason, "Adopted from last week's review."],
        deepLink: rec.deepLink ?? "/workspace/jobs/queue",
        category: rec.recommendedActionType === "JOB_APPLY" ? "jobs" : "jobs",
        estimatedMinutes: 30,
      });
      continue;
    }

    if (rec.recommendedActionType === "LINKEDIN_PUBLISH") {
      const plan = await prisma.linkedinPublishingPlan.findFirst({
        where: { userId: input.userId, status: { in: ["READY", "SCHEDULED"] }, publishedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (!plan) continue;
      results.push({
        type: "LINKEDIN_PUBLISH",
        origin: "SYSTEM_RECOMMENDED",
        sourceEntityType: "LINKEDIN_POST",
        sourceEntityId: plan.linkedinPostId,
        intent: `weekly-handoff:${rec.fingerprint}`,
        title: rec.title,
        whyNowFacts: [rec.reason, "Adopted from last week's review."],
        deepLink: rec.deepLink ?? "/workspace/linkedin",
        category: "linkedin",
        estimatedMinutes: 15,
      });
      continue;
    }

    results.push({
      type: rec.recommendedActionType ?? "CUSTOM_CAREER_ACTION",
      origin: "SYSTEM_RECOMMENDED",
      sourceEntityType: rec.recommendedActionType === "EVIDENCE_BUILDING" ? "SKILL" : "CAREER_CONTEXT",
      sourceEntityId: null,
      intent: `weekly-handoff:${rec.fingerprint}`,
      title: rec.title,
      whyNowFacts: [rec.reason, "Adopted from last week's review."],
      deepLink: rec.deepLink ?? "/workspace/today",
      category: rec.recommendedActionType === "EVIDENCE_BUILDING" ? "skills" : "setup",
      estimatedMinutes: 15,
    });
  }

  return results.slice(0, MAX_HANDOFF_CANDIDATES);
}
