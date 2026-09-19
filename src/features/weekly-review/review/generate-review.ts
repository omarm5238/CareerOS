import { prisma } from "@/server/db/prisma";

import { WeeklyReviewAccessError } from "../errors";
import { contextFingerprint } from "../lib/fingerprint";
import { toPrismaJson } from "../lib/json";
import { toReviewView } from "../lib/views";
import { collectWeeklyCareerFacts } from "../facts/collect-facts";
import { metricsFromFacts } from "../metrics/from-facts";
import { scoreWeeklyMomentum } from "../momentum/score-momentum";
import { detectWeeklyInsights } from "../insights/detect-insights";
import { assistWeeklyReviewWording } from "../insights/assist-wording";
import { buildWeeklyRecommendations } from "../recommendations/build-recommendations";
import { getCareerWeekBounds, resolveRequestedWeekStart } from "../period/week-bounds";
import { getOrCreateDailyRoadmapPreference } from "@/features/daily-roadmap/preferences/preference-service";
import type { WeeklyComponentResult, WeeklyReviewView } from "../types";

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

const includeReview = {
  metrics: true,
  insights: true,
  recommendations: { orderBy: { createdAt: "asc" as const } },
};

export async function getOwnedReview(userId: string, reviewId: string) {
  const review = await prisma.weeklyCareerReview.findFirst({
    where: { id: reviewId, userId },
    include: includeReview,
  });
  if (!review) throw new WeeklyReviewAccessError("NOT_FOUND", "Weekly review not found.");
  return review;
}

export async function loadPreviousFinalized(userId: string, weekStartLocalDate: string) {
  return prisma.weeklyCareerReview.findFirst({
    where: {
      userId,
      status: "FINALIZED",
      weekStartLocalDate: { lt: weekStartLocalDate },
    },
    include: includeReview,
    orderBy: { weekStartLocalDate: "desc" },
  });
}

async function persistSnapshot(input: {
  userId: string;
  reviewId: string;
  facts: Awaited<ReturnType<typeof collectWeeklyCareerFacts>>;
  momentum: ReturnType<typeof scoreWeeklyMomentum>;
  metrics: ReturnType<typeof metricsFromFacts>;
  insights: ReturnType<typeof detectWeeklyInsights>["insights"];
  wins: string[];
  friction: string[];
  recommendations: ReturnType<typeof buildWeeklyRecommendations>;
  generationSource: "DETERMINISTIC" | "AI_ASSISTED" | "FALLBACK";
  summary: string;
  preserveDecisions?: Map<string, { status: "OPEN" | "ADOPTED" | "DISMISSED"; adoptedAt: Date | null }>;
  fingerprint: string;
  refreshed?: boolean;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.weeklyCareerMetric.deleteMany({ where: { weeklyCareerReviewId: input.reviewId } });
    await tx.weeklyCareerInsight.deleteMany({ where: { weeklyCareerReviewId: input.reviewId } });
    const existingRecs = await tx.weeklyCareerRecommendation.findMany({
      where: { weeklyCareerReviewId: input.reviewId },
    });
    const keepFingerprints = new Set(input.recommendations.map((item) => item.fingerprint));
    await tx.weeklyCareerRecommendation.deleteMany({
      where: {
        weeklyCareerReviewId: input.reviewId,
        fingerprint: { notIn: [...keepFingerprints] },
        status: "OPEN",
      },
    });

    if (input.metrics.length > 0) {
      await tx.weeklyCareerMetric.createMany({
        data: input.metrics.map((metric) => ({
          userId: input.userId,
          weeklyCareerReviewId: input.reviewId,
          category: metric.category,
          metricKey: metric.metricKey,
          numericValue: metric.numericValue ?? null,
          textValue: metric.textValue ?? null,
          denominatorValue: metric.denominatorValue ?? null,
          applicability: metric.applicability,
          sourceSubsystem: metric.sourceSubsystem,
          evidenceJson: toPrismaJson(metric.evidence),
        })),
      });
    }
    if (input.insights.length > 0) {
      await tx.weeklyCareerInsight.createMany({
        data: input.insights.map((item) => ({
          userId: input.userId,
          weeklyCareerReviewId: input.reviewId,
          type: item.type,
          category: item.category,
          title: item.title,
          summary: item.summary,
          evidenceJson: toPrismaJson(item.evidence),
          confidence: item.confidence,
          severity: item.severity,
          fingerprint: item.fingerprint,
        })),
      });
    }

    for (const rec of input.recommendations) {
      const preserved = input.preserveDecisions?.get(rec.fingerprint);
      const existing = existingRecs.find((row) => row.fingerprint === rec.fingerprint);
      const status = preserved?.status ?? existing?.status ?? "OPEN";
      const adoptedAt = preserved?.adoptedAt ?? existing?.adoptedAt ?? null;
      await tx.weeklyCareerRecommendation.upsert({
        where: {
          weeklyCareerReviewId_fingerprint: {
            weeklyCareerReviewId: input.reviewId,
            fingerprint: rec.fingerprint,
          },
        },
        update: {
          title: rec.title,
          reason: rec.reason,
          category: rec.category,
          priority: rec.priority,
          sourceEvidenceJson: toPrismaJson(rec.sourceEvidence),
          recommendedActionType: rec.recommendedActionType,
          deepLink: rec.deepLink,
          status,
          adoptedAt,
        },
        create: {
          userId: input.userId,
          weeklyCareerReviewId: input.reviewId,
          category: rec.category,
          title: rec.title,
          reason: rec.reason,
          priority: rec.priority,
          sourceEvidenceJson: toPrismaJson(rec.sourceEvidence),
          recommendedActionType: rec.recommendedActionType,
          deepLink: rec.deepLink,
          status,
          adoptedAt,
          fingerprint: rec.fingerprint,
        },
      });
    }

    await tx.weeklyCareerReview.update({
      where: { id: input.reviewId },
      data: {
        contextFingerprint: input.fingerprint,
        generationSource: input.generationSource,
        overallMomentumScore: input.momentum.overallScore,
        overallMomentumBand: input.momentum.band,
        summary: input.summary,
        winsSummary: input.wins.join(" "),
        frictionSummary: input.friction.join(" "),
        componentsJson: toPrismaJson({ components: input.momentum.components }),
        comparisonJson: toPrismaJson({
          previousOverallScore: input.momentum.previousOverallScore,
          overallDelta: input.momentum.overallDelta,
          firstReview: input.momentum.firstReview,
        }),
        winsJson: toPrismaJson(input.wins),
        frictionJson: toPrismaJson(input.friction),
        limitationsJson: toPrismaJson(input.facts.limitations),
        refreshedAt: input.refreshed ? new Date() : undefined,
      },
    });
  });
}

async function buildAndPersist(userId: string, reviewId: string, weekStartLocalDate: string, timezone: string, options?: { refresh?: boolean }) {
  const period = getCareerWeekBounds(weekStartLocalDate, timezone);
  const facts = await collectWeeklyCareerFacts(userId, period);
  const previous = await loadPreviousFinalized(userId, weekStartLocalDate);
  const previousComponents = previous
    ? ((previous.componentsJson as { components?: WeeklyComponentResult[] }).components ?? [])
    : [];
  const momentum = scoreWeeklyMomentum(
    facts,
    previous
      ? { overallScore: previous.overallMomentumScore, components: previousComponents }
      : null,
  );
  const metrics = metricsFromFacts(facts);
  const history = await prisma.weeklyCareerReview.findMany({
    where: { userId, status: "FINALIZED", weekStartLocalDate: { lt: weekStartLocalDate } },
    include: { insights: true },
    orderBy: { weekStartLocalDate: "desc" },
    take: 4,
  });
  const detected = detectWeeklyInsights(
    facts,
    momentum,
    history.map((row) => ({
      weekStartLocalDate: row.weekStartLocalDate,
      insightTypes: row.insights.map((item) => item.type),
      overallScore: row.overallMomentumScore,
    })),
  );
  const recommendations = buildWeeklyRecommendations(facts, detected.insights);
  const wording = await assistWeeklyReviewWording({
    facts,
    momentum,
    wins: detected.wins,
    friction: detected.friction,
    insights: detected.insights,
    recommendations,
  });
  const insights = detected.insights.map((item) => ({
    ...item,
    summary: wording.insightSummaries[item.fingerprint] ?? item.summary,
  }));
  const recs = recommendations.map((item) => ({
    ...item,
    reason: wording.recommendationReasons[item.fingerprint] ?? item.reason,
  }));
  const fingerprint = contextFingerprint({
    weekStartLocalDate,
    weekEndLocalDate: period.weekEndLocalDate,
    timezone,
    metrics: metrics.map((metric) => [metric.metricKey, metric.numericValue, metric.applicability]),
    includeLinkedIn: facts.preferences.includeLinkedIn,
    includeSkillDevelopment: facts.preferences.includeSkillDevelopment,
  });

  const existingRecs = await prisma.weeklyCareerRecommendation.findMany({
    where: { weeklyCareerReviewId: reviewId },
  });
  const preserve = new Map(
    existingRecs.map((row) => [row.fingerprint, { status: row.status, adoptedAt: row.adoptedAt }]),
  );

  await persistSnapshot({
    userId,
    reviewId,
    facts,
    momentum,
    metrics,
    insights,
    wins: wording.wins,
    friction: wording.friction,
    recommendations: recs,
    generationSource: wording.source,
    summary: wording.summary,
    preserveDecisions: preserve,
    fingerprint,
    refreshed: options?.refresh,
  });
}

export async function generateWeeklyReview(
  userId: string,
  body: Record<string, unknown> = {},
  options?: { now?: Date },
): Promise<WeeklyReviewView> {
  void body.userId;
  void body.overallMomentumScore;
  void body.overallMomentumBand;
  void body.status;
  void body.finalizedAt;
  void body.generationSource;

  const now = options?.now ?? new Date();
  const preferences = await getOrCreateDailyRoadmapPreference(userId);
  const period = resolveRequestedWeekStart(body.weekStartLocalDate, now, preferences.timezone);

  const existing = await prisma.weeklyCareerReview.findUnique({
    where: { userId_weekStartLocalDate: { userId, weekStartLocalDate: period.weekStartLocalDate } },
    include: includeReview,
  });
  if (existing) return toReviewView(existing, now);

  try {
    const created = await prisma.weeklyCareerReview.create({
      data: {
        userId,
        weekStartLocalDate: period.weekStartLocalDate,
        weekEndLocalDate: period.weekEndLocalDate,
        timezone: period.timezone,
        contextFingerprint: "pending",
        generationSource: "DETERMINISTIC",
      },
    });
    await buildAndPersist(userId, created.id, period.weekStartLocalDate, period.timezone);
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
  }

  const review = await prisma.weeklyCareerReview.findUniqueOrThrow({
    where: { userId_weekStartLocalDate: { userId, weekStartLocalDate: period.weekStartLocalDate } },
    include: includeReview,
  });
  if (review.contextFingerprint === "pending") {
    await buildAndPersist(userId, review.id, period.weekStartLocalDate, period.timezone);
  }
  const complete = await prisma.weeklyCareerReview.findUniqueOrThrow({
    where: { id: review.id },
    include: includeReview,
  });
  return toReviewView(complete, now);
}

export async function refreshWeeklyReview(userId: string, reviewId: string): Promise<WeeklyReviewView> {
  const review = await getOwnedReview(userId, reviewId);
  if (review.status === "FINALIZED") {
    throw new WeeklyReviewAccessError("CONFLICT", "Finalized weekly reviews cannot be refreshed.");
  }
  await buildAndPersist(userId, review.id, review.weekStartLocalDate, review.timezone, { refresh: true });
  const updated = await getOwnedReview(userId, reviewId);
  return toReviewView(updated);
}

export async function finalizeWeeklyReview(userId: string, reviewId: string, now = new Date()): Promise<WeeklyReviewView> {
  const review = await getOwnedReview(userId, reviewId);
  if (review.status === "FINALIZED") return toReviewView(review, now);
  const period = getCareerWeekBounds(review.weekStartLocalDate, review.timezone);
  if (!period.isComplete) {
    throw new WeeklyReviewAccessError("CONFLICT", "A weekly review can be finalized only after the local week ends.");
  }
  await buildAndPersist(userId, review.id, review.weekStartLocalDate, review.timezone, { refresh: true });
  const frozen = await prisma.weeklyCareerReview.update({
    where: { id: review.id },
    data: { status: "FINALIZED", finalizedAt: now },
    include: includeReview,
  });
  return toReviewView(frozen, now);
}
