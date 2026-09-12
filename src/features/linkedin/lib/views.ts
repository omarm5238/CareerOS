import type {
  linkedinContentIdea,
  linkedinContentPillar,
  linkedinGrowthInsight,
  linkedinGrowthProfile,
  linkedinPost,
  linkedinPostPerformance,
  linkedinPostRevision,
  linkedinPublishingPlan,
} from "@/generated/prisma/client";

import type {
  LinkedinGrowthGoal,
  LinkedinIdeaView,
  LinkedinInsightView,
  LinkedinPerformanceSnapshotView,
  LinkedinPillarView,
  LinkedinPostView,
  LinkedinPublishingPlanView,
  LinkedinRevisionView,
  LinkedinStrategyView,
} from "../types";
import { calculateLinkedinPerformanceMetrics } from "../performance/calculate-linkedin-performance-metrics";
import { asStringArray, parseEvidenceItems, parseProfileSnapshot, parseWarnings } from "./json-parsers";
import { isGrowthGoal } from "./permissions";

export function toPillarView(row: linkedinContentPillar): LinkedinPillarView {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    goal: row.goal,
    audience: row.audience,
    priority: row.priority,
    evidenceSources: asStringArray(row.evidenceSourcesJson, 12),
    exampleAngles: asStringArray(row.exampleAnglesJson, 8),
    isActive: row.isActive,
  };
}

export function toStrategyView(
  row: linkedinGrowthProfile & { pillars?: linkedinContentPillar[] },
): LinkedinStrategyView {
  return {
    id: row.id,
    status: row.status,
    primaryGoal: row.primaryGoal,
    secondaryGoals: asStringArray(row.secondaryGoalsJson, 8).filter(isGrowthGoal) as LinkedinGrowthGoal[],
    targetRoleTitles: asStringArray(row.targetRoleTitlesJson, 12),
    targetAudience: asStringArray(row.targetAudienceJson, 12),
    positioningStatement: row.positioningStatement,
    professionalThemes: asStringArray(row.professionalThemesJson, 12),
    contentTone: row.contentTone,
    preferredLanguage: row.preferredLanguage,
    postingFrequencyTarget: row.postingFrequencyTarget,
    visibilityGoal: row.visibilityGoal,
    recruiterGoal: row.recruiterGoal,
    networkGoal: row.networkGoal,
    profileSnapshot: parseProfileSnapshot(row.profileSnapshotJson),
    lastStrategyRefreshAt: row.lastStrategyRefreshAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    warnings: [],
    pillars: (row.pillars ?? []).map(toPillarView),
  };
}

export function toIdeaView(
  row: linkedinContentIdea & { pillar?: { name: string } | null },
  why?: string,
): LinkedinIdeaView {
  return {
    id: row.id,
    pillarId: row.pillarId,
    pillarName: row.pillar?.name ?? null,
    title: row.title,
    angle: row.angle,
    summary: row.summary,
    format: row.format,
    objective: row.objective,
    audience: row.audience,
    evidenceStrength: row.evidenceStrength,
    recruiterRelevance: row.recruiterRelevance,
    timeliness: row.timeliness,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    priorityScore: row.priorityScore,
    status: row.status,
    why: why ?? row.summary,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRevisionView(row: linkedinPostRevision): LinkedinRevisionView {
  return {
    id: row.id,
    revisionNumber: row.revisionNumber,
    source: row.source,
    hook: row.hook,
    body: row.body,
    cta: row.cta,
    tone: row.tone,
    language: row.language,
    hashtags: asStringArray(row.hashtagsJson, 6),
    mentions: asStringArray(row.mentionsJson, 4),
    evidence: parseEvidenceItems(row.evidenceJson),
    warnings: parseWarnings(row.warningsJson),
    qaStatus: row.qaStatus,
    qaFingerprint: row.qaFingerprint,
    generationStatus: row.generationStatus,
    aiSource: row.aiSource,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPlanView(
  row: linkedinPublishingPlan & { linkedinPostRevision?: { revisionNumber: number } },
  activeRevisionId?: string | null,
): LinkedinPublishingPlanView {
  const newer = Boolean(activeRevisionId && activeRevisionId !== row.linkedinPostRevisionId);
  return {
    id: row.id,
    postId: row.linkedinPostId,
    revisionId: row.linkedinPostRevisionId,
    revisionNumber: row.linkedinPostRevision?.revisionNumber ?? 0,
    status: row.status,
    publishMode: row.publishMode,
    plannedPublishAt: row.plannedPublishAt?.toISOString() ?? null,
    timezone: row.timezone,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishingSource: row.publishingSource,
    newerActiveRevision: newer,
    newerRevisionWarning: newer
      ? `A newer revision exists. This publishing plan still uses Revision ${row.linkedinPostRevision?.revisionNumber ?? "?"}.`
      : null,
  };
}

export function toPerformanceView(row: linkedinPostPerformance): LinkedinPerformanceSnapshotView {
  const derived = calculateLinkedinPerformanceMetrics(row);
  return {
    id: row.id,
    capturedAt: row.capturedAt.toISOString(),
    impressions: row.impressions,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    reposts: row.reposts,
    saves: row.saves,
    profileViews: row.profileViews,
    newFollowers: row.newFollowers,
    connectionRequests: row.connectionRequests,
    recruiterMessages: row.recruiterMessages,
    source: row.source,
    notes: row.notes,
    engagementCount: derived.engagementCount,
    engagementRate: derived.engagementRate,
  };
}

export function toPostView(
  row: linkedinPost & {
    pillar?: { name: string } | null;
    activeRevision?: linkedinPostRevision | null;
    revisions?: linkedinPostRevision[];
    publishingPlans?: Array<linkedinPublishingPlan & { linkedinPostRevision?: { revisionNumber: number } }>;
    performances?: linkedinPostPerformance[];
  },
): LinkedinPostView {
  return {
    id: row.id,
    status: row.status,
    objective: row.objective,
    format: row.format,
    intendedAudience: row.intendedAudience,
    pillarId: row.pillarId,
    pillarName: row.pillar?.name ?? null,
    ideaId: row.contentIdeaId,
    activeRevisionId: row.activeRevisionId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishingSource: row.publishingSource,
    externalLinkedInUrl: row.externalLinkedInUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    activeRevision: row.activeRevision ? toRevisionView(row.activeRevision) : null,
    revisions: (row.revisions ?? []).map(toRevisionView),
    publishingPlans: (row.publishingPlans ?? []).map((plan) => toPlanView(plan, row.activeRevisionId)),
    performances: (row.performances ?? []).map(toPerformanceView),
  };
}

export function toInsightView(row: linkedinGrowthInsight): LinkedinInsightView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    confidence: row.confidence,
    status: row.status,
    evidence: (row.evidenceJson && typeof row.evidenceJson === "object" ? row.evidenceJson : {}) as Record<
      string,
      unknown
    >,
    createdAt: row.createdAt.toISOString(),
  };
}
