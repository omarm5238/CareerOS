import { prisma } from "@/server/db/prisma";

import { getOrCreateDailyRoadmapPreference } from "@/features/daily-roadmap/preferences/preference-service";
import {
  formatWeekLabel,
  getCareerWeekBounds,
  getPreviousWeekStartLocalDate,
  WEEKLY_HISTORY_BOUND,
} from "../period/week-bounds";
import { toHistoryItem, toReviewView } from "../lib/views";
import { getOwnedReview } from "./generate-review";
import type { WeeklyWorkspaceView, WeeklyReviewView } from "../types";

export async function getWeeklyReviewWorkspace(
  userId: string,
  options?: { now?: Date },
): Promise<WeeklyWorkspaceView> {
  const now = options?.now ?? new Date();
  const preferences = await getOrCreateDailyRoadmapPreference(userId);
  const currentPeriod = getCareerWeekBounds(now, preferences.timezone);
  const current = await prisma.weeklyCareerReview.findUnique({
    where: {
      userId_weekStartLocalDate: { userId, weekStartLocalDate: currentPeriod.weekStartLocalDate },
    },
    include: {
      metrics: true,
      insights: true,
      recommendations: { orderBy: { createdAt: "asc" } },
    },
  });
  const historyRows = await prisma.weeklyCareerReview.findMany({
    where: { userId, status: "FINALIZED" },
    include: { metrics: true },
    orderBy: { weekStartLocalDate: "desc" },
    take: WEEKLY_HISTORY_BOUND,
  });
  const previousWeekStart = getPreviousWeekStartLocalDate(currentPeriod.weekStartLocalDate);
  const previousExists = await prisma.weeklyCareerReview.findUnique({
    where: { userId_weekStartLocalDate: { userId, weekStartLocalDate: previousWeekStart } },
    select: { id: true },
  });

  return {
    current: current ? toReviewView(current, now) : null,
    period: {
      weekStartLocalDate: currentPeriod.weekStartLocalDate,
      weekEndLocalDate: currentPeriod.weekEndLocalDate,
      weekLabel: formatWeekLabel(currentPeriod.weekStartLocalDate, currentPeriod.weekEndLocalDate),
      timezone: currentPeriod.timezone,
      isComplete: currentPeriod.isComplete,
      isCurrent: true,
    },
    history: historyRows.map(toHistoryItem),
    latestCompletedMissing: !previousExists,
    latestCompletedWeekStart: previousExists ? null : previousWeekStart,
  };
}

export async function getWeeklyReviewById(userId: string, reviewId: string): Promise<WeeklyReviewView> {
  const review = await getOwnedReview(userId, reviewId);
  return toReviewView(review);
}

export async function listWeeklyReviewHistory(userId: string) {
  const rows = await prisma.weeklyCareerReview.findMany({
    where: { userId, status: "FINALIZED" },
    include: { metrics: true },
    orderBy: { weekStartLocalDate: "desc" },
    take: WEEKLY_HISTORY_BOUND,
  });
  return rows.map(toHistoryItem);
}
