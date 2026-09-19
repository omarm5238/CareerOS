import type {
  weeklyCareerInsight,
  weeklyCareerMetric,
  weeklyCareerRecommendation,
  weeklyCareerReview,
} from "@/generated/prisma/client";

import { asRecord, asStringArray } from "./json";
import { formatWeekLabel, getCareerWeekBounds } from "../period/week-bounds";
import { confidenceLabel } from "../insights/detect-insights";
import type { WeeklyComponentResult, WeeklyHistoryItem, WeeklyReviewView } from "../types";

type ReviewRecord = weeklyCareerReview & {
  metrics: weeklyCareerMetric[];
  insights: weeklyCareerInsight[];
  recommendations: weeklyCareerRecommendation[];
};

export function toReviewView(review: ReviewRecord, now = new Date()): WeeklyReviewView {
  const period = getCareerWeekBounds(review.weekStartLocalDate, review.timezone);
  const components = Array.isArray(review.componentsJson)
    ? []
    : ((asRecord(review.componentsJson).components as WeeklyComponentResult[] | undefined) ?? []);
  const comparison = asRecord(review.comparisonJson);
  return {
    id: review.id,
    weekStartLocalDate: review.weekStartLocalDate,
    weekEndLocalDate: review.weekEndLocalDate,
    weekLabel: formatWeekLabel(review.weekStartLocalDate, review.weekEndLocalDate),
    timezone: review.timezone,
    status: review.status,
    generatedAt: review.generatedAt.toISOString(),
    refreshedAt: review.refreshedAt?.toISOString() ?? null,
    finalizedAt: review.finalizedAt?.toISOString() ?? null,
    generationSource: review.generationSource,
    overallMomentumScore: review.overallMomentumScore,
    overallMomentumBand: review.overallMomentumBand,
    summary: review.summary,
    winsSummary: review.winsSummary,
    frictionSummary: review.frictionSummary,
    wins: asStringArray(review.winsJson),
    friction: asStringArray(review.frictionJson),
    limitations: asStringArray(review.limitationsJson),
    components,
    previousOverallScore: typeof comparison.previousOverallScore === "number" ? comparison.previousOverallScore : null,
    overallDelta: typeof comparison.overallDelta === "number" ? comparison.overallDelta : null,
    firstReview: comparison.firstReview === true,
    isCurrent: period.isCurrent && getCareerWeekBounds(now, review.timezone).weekStartLocalDate === review.weekStartLocalDate,
    isComplete: period.isComplete,
    metrics: review.metrics.map((metric) => ({
      id: metric.id,
      category: metric.category,
      metricKey: metric.metricKey,
      numericValue: metric.numericValue,
      textValue: metric.textValue,
      denominatorValue: metric.denominatorValue,
      applicability: metric.applicability,
      sourceSubsystem: metric.sourceSubsystem,
      evidence: asRecord(metric.evidenceJson),
    })),
    insights: review.insights.map((item) => ({
      id: item.id,
      type: item.type,
      category: item.category,
      title: item.title,
      summary: item.summary,
      confidence: item.confidence,
      confidenceLabel: confidenceLabel(item.confidence),
      severity: item.severity,
      evidence: asRecord(item.evidenceJson),
    })),
    recommendations: review.recommendations.map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      reason: item.reason,
      priority: item.priority,
      recommendedActionType: item.recommendedActionType,
      deepLink: item.deepLink,
      status: item.status,
      adoptedAt: item.adoptedAt?.toISOString() ?? null,
      fingerprint: item.fingerprint,
    })),
  };
}

export function toHistoryItem(review: weeklyCareerReview & { metrics?: weeklyCareerMetric[] }): WeeklyHistoryItem {
  const active = review.metrics?.find((metric) => metric.metricKey === "execution.active_days");
  return {
    id: review.id,
    weekStartLocalDate: review.weekStartLocalDate,
    weekEndLocalDate: review.weekEndLocalDate,
    weekLabel: formatWeekLabel(review.weekStartLocalDate, review.weekEndLocalDate),
    status: review.status,
    overallMomentumScore: review.overallMomentumScore,
    overallMomentumBand: review.overallMomentumBand,
    activeDays: active?.numericValue ?? null,
  };
}
