import { prisma } from "@/server/db/prisma";

import type { LinkedinOverviewView } from "../types";
import { toPerformanceView } from "../lib/views";
import { findLinkedinVisibilityGaps } from "../recommendations/find-linkedin-visibility-gaps";
import { recommendNextLinkedinIdeas } from "../recommendations/recommend-next-linkedin-ideas";
import { getLinkedinStrategy } from "../strategy/get-linkedin-strategy";

export async function getLinkedinOverview(userId: string): Promise<LinkedinOverviewView> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [strategy, readyDraftCount, scheduledCount, publishedThisMonth, next, visibilityGaps, recent] =
    await Promise.all([
      getLinkedinStrategy(userId),
      prisma.linkedinPost.count({ where: { userId, status: "READY" } }),
      prisma.linkedinPublishingPlan.count({ where: { userId, status: { in: ["READY", "SCHEDULED"] } } }),
      prisma.linkedinPost.count({
        where: { userId, status: "PUBLISHED", publishedAt: { gte: startOfMonth } },
      }),
      recommendNextLinkedinIdeas(userId),
      findLinkedinVisibilityGaps(userId),
      prisma.linkedinPostPerformance.findMany({
        where: { userId },
        orderBy: { capturedAt: "desc" },
        take: 5,
      }),
    ]);

  return {
    strategy,
    readyDraftCount,
    scheduledCount,
    publishedThisMonth,
    nextRecommendation: next[0] ?? null,
    visibilityGaps,
    recentPerformance: recent.map(toPerformanceView),
  };
}
