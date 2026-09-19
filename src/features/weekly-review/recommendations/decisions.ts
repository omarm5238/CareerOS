import { prisma } from "@/server/db/prisma";

import { WeeklyReviewAccessError } from "../errors";
import { toReviewView } from "../lib/views";
import { getOwnedReview } from "../review/generate-review";
import type { WeeklyReviewView } from "../types";

async function getOwnedRecommendation(userId: string, recommendationId: string) {
  const recommendation = await prisma.weeklyCareerRecommendation.findFirst({
    where: { id: recommendationId, userId },
    include: { review: true },
  });
  if (!recommendation) {
    throw new WeeklyReviewAccessError("NOT_FOUND", "Weekly recommendation not found.");
  }
  return recommendation;
}

export async function adoptWeeklyRecommendation(
  userId: string,
  recommendationId: string,
  body: Record<string, unknown> = {},
): Promise<WeeklyReviewView> {
  void body.userId;
  void body.status;
  void body.priority;
  const recommendation = await getOwnedRecommendation(userId, recommendationId);
  if (recommendation.status !== "ADOPTED") {
    await prisma.weeklyCareerRecommendation.update({
      where: { id: recommendation.id },
      data: { status: "ADOPTED", adoptedAt: new Date() },
    });
  }
  return toReviewView(await getOwnedReview(userId, recommendation.weeklyCareerReviewId));
}

export async function dismissWeeklyRecommendation(
  userId: string,
  recommendationId: string,
  body: Record<string, unknown> = {},
): Promise<WeeklyReviewView> {
  void body.userId;
  void body.status;
  const recommendation = await getOwnedRecommendation(userId, recommendationId);
  await prisma.weeklyCareerRecommendation.update({
    where: { id: recommendation.id },
    data: { status: "DISMISSED" },
  });
  return toReviewView(await getOwnedReview(userId, recommendation.weeklyCareerReviewId));
}
