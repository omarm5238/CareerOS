import { getCareerOsReportDataForUser } from "@/features/report/server";
import { prisma } from "@/server/db/prisma";

const SCHEMA_VERSION = "m29.1";
const CAREEROS_VERSION = "0.1.0";
const EXPORT_PAGE_SIZE = 100;
const BLOCKED_KEY =
  /password|passwd|secret|token|authorization|api[-_]?key|refresh[-_]?token|encrypted|pkce|access[-_]?token|session|cookie|credential|verifier/i;

function parseJsonArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function truncate(value: string | null | undefined, max = 400): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function stripExportSecrets(value: unknown, key?: string): unknown {
  if (key && BLOCKED_KEY.test(key)) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => stripExportSecrets(item));
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (BLOCKED_KEY.test(entryKey)) continue;
      next[entryKey] = stripExportSecrets(entryValue, entryKey);
    }
    return next;
  }
  return value;
}

type PageArgs = {
  take: number;
  skip?: number;
  cursor?: { id: string };
};

async function paginateById<T extends { id: string }>(
  loadPage: (page: PageArgs) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const batch = await loadPage(
      cursor ? { take: EXPORT_PAGE_SIZE, skip: 1, cursor: { id: cursor } } : { take: EXPORT_PAGE_SIZE },
    );
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < EXPORT_PAGE_SIZE) break;
    cursor = batch[batch.length - 1]?.id;
    if (!cursor) break;
  }
  return rows;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = grouped.get(id);
    if (list) list.push(row);
    else grouped.set(id, [row]);
  }
  return grouped;
}

export async function exportWorkspaceDataForUser(userId: string) {
  const [
    profile,
    discovery,
    memoryPreference,
    roadmapPreference,
    resumeDocuments,
    resumeVersions,
    resumeRevisions,
    jobPostings,
    discoveredJobs,
    queueItems,
    applications,
    applicationEvents,
    drafts,
    linkedinPosts,
    linkedinRevisions,
    linkedinPlans,
    linkedinPerformances,
    roadmaps,
    roadmapActions,
    activityDays,
    reviews,
    weeklyMetrics,
    weeklyInsights,
    weeklyRecommendations,
    memories,
    memoryEvidence,
    graphEntities,
    graphRelations,
    skillsInsights,
    careerBriefs,
    report,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    }),
    prisma.jobDiscoveryProfile.findUnique({
      where: { userId },
      select: {
        roleTargetsJson: true,
        locationTargetsJson: true,
        workModesJson: true,
        applicationPreparationMode: true,
        updatedAt: true,
      },
    }),
    prisma.careerMemoryPreference.findUnique({
      where: { userId },
      select: {
        memoryEnabled: true,
        allowBehavioralMemory: true,
        allowDerivedPatterns: true,
        allowLongTermPreferences: true,
        memoryResetAt: true,
      },
    }),
    prisma.dailyRoadmapPreference.findUnique({
      where: { userId },
      select: { timezone: true, activeWeekdaysJson: true, dailyMinutesTarget: true },
    }),
    paginateById((page) =>
      prisma.resumeDocument.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          filename: true,
          mimeType: true,
          fileSize: true,
          textLength: true,
          createdAt: true,
          analysis: {
            select: {
              detectedRole: true,
              experienceLevel: true,
              completenessScore: true,
              analysisSource: true,
              createdAt: true,
            },
          },
        },
      }),
    ),
    paginateById((page) =>
      prisma.resumeVersion.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          activeRevisionId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.resumeVersionRevision.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          resumeVersionId: true,
          revisionNumber: true,
          source: true,
          createdAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.jobPosting.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          jobUrl: true,
          source: true,
          applicationStatus: true,
          createdAt: true,
          description: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.discoveredJob.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          title: true,
          company: true,
          discoveryStatus: true,
          finalScore: true,
          scoreBand: true,
          lastSeenAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.applicationQueueItem.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: { id: true, queueStatus: true, updatedAt: true, discoveredJobId: true },
      }),
    ),
    paginateById((page) =>
      prisma.application.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          status: true,
          source: true,
          appliedAt: true,
          lastActivityAt: true,
          closedAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.applicationEvent.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          applicationId: true,
          type: true,
          title: true,
          fromStatus: true,
          toStatus: true,
          eventAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.communicationDraft.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: { id: true, type: true, status: true, usedAt: true, createdAt: true, applicationId: true },
      }),
    ),
    paginateById((page) =>
      prisma.linkedinPost.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          status: true,
          objective: true,
          format: true,
          publishingSource: true,
          publishedAt: true,
          createdAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.linkedinPostRevision.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          linkedinPostId: true,
          revisionNumber: true,
          source: true,
          qaStatus: true,
          createdAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.linkedinPublishingPlan.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          linkedinPostId: true,
          status: true,
          publishMode: true,
          publishingSource: true,
          publishedAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.linkedinPostPerformance.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          linkedinPostId: true,
          capturedAt: true,
          impressions: true,
          views: true,
          likes: true,
          comments: true,
          source: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.dailyRoadmap.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          localDate: true,
          timezone: true,
          status: true,
          plannedMinutes: true,
          generationSource: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.dailyRoadmapAction.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          dailyRoadmapId: true,
          type: true,
          title: true,
          status: true,
          estimatedMinutes: true,
          completedAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.careerActivityDay.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: { id: true, localDate: true, meaningfulActionCount: true, qualifiesForStreak: true },
      }),
    ),
    paginateById((page) =>
      prisma.weeklyCareerReview.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          weekStartLocalDate: true,
          weekEndLocalDate: true,
          status: true,
          overallMomentumScore: true,
          overallMomentumBand: true,
          finalizedAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.weeklyCareerMetric.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          weeklyCareerReviewId: true,
          category: true,
          metricKey: true,
          numericValue: true,
          applicability: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.weeklyCareerInsight.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          weeklyCareerReviewId: true,
          type: true,
          title: true,
          confidence: true,
          severity: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.weeklyCareerRecommendation.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          weeklyCareerReviewId: true,
          title: true,
          priority: true,
          status: true,
          adoptedAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.careerMemory.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          type: true,
          category: true,
          subjectKey: true,
          normalizedText: true,
          status: true,
          confidence: true,
          sourceType: true,
          lastObservedAt: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.careerMemoryEvidence.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: {
          id: true,
          careerMemoryId: true,
          sourceSubsystem: true,
          evidenceType: true,
          observedAt: true,
          weight: true,
        },
      }),
    ),
    paginateById((page) =>
      prisma.careerGraphEntity.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: { id: true, entityType: true, canonicalKey: true, displayName: true, status: true },
      }),
    ),
    paginateById((page) =>
      prisma.careerGraphRelation.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: { id: true, relationType: true, confidence: true, fingerprint: true, status: true },
      }),
    ),
    paginateById((page) =>
      prisma.skillsInsight.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: { id: true, analysisSource: true, skillCoverageScore: true, createdAt: true },
      }),
    ),
    paginateById((page) =>
      prisma.careerBrief.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        ...page,
        select: { id: true, analysisSource: true, healthScore: true, headline: true, createdAt: true },
      }),
    ),
    getCareerOsReportDataForUser(userId),
  ]);

  if (!profile) return null;

  const revisionsByVersion = groupBy(resumeRevisions, (row) => row.resumeVersionId);
  const eventsByApplication = groupBy(applicationEvents, (row) => row.applicationId);
  const revisionsByPost = groupBy(linkedinRevisions, (row) => row.linkedinPostId);
  const performancesByPost = groupBy(linkedinPerformances, (row) => row.linkedinPostId);
  const actionsByRoadmap = groupBy(roadmapActions, (row) => row.dailyRoadmapId);
  const metricsByReview = groupBy(weeklyMetrics, (row) => row.weeklyCareerReviewId);
  const insightsByReview = groupBy(weeklyInsights, (row) => row.weeklyCareerReviewId);
  const recommendationsByReview = groupBy(weeklyRecommendations, (row) => row.weeklyCareerReviewId);
  const evidenceByMemory = groupBy(memoryEvidence, (row) => row.careerMemoryId);

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    careerOSVersion: CAREEROS_VERSION,
    data: {
      profile: {
        name: profile.name,
        email: profile.email,
        createdAt: iso(profile.createdAt),
      },
      preferences: {
        discovery: discovery
          ? {
              roleTargets: parseJsonArray(discovery.roleTargetsJson),
              locationTargets: parseJsonArray(discovery.locationTargetsJson),
              workModes: parseJsonArray(discovery.workModesJson),
              applicationPreparationMode: discovery.applicationPreparationMode,
              updatedAt: iso(discovery.updatedAt),
            }
          : null,
        dailyRoadmap: roadmapPreference,
        memory: memoryPreference
          ? { ...memoryPreference, memoryResetAt: iso(memoryPreference.memoryResetAt) }
          : null,
      },
      resumes: {
        documents: resumeDocuments.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          textLength: doc.textLength,
          createdAt: iso(doc.createdAt),
          analysis: doc.analysis,
        })),
        versions: resumeVersions.map((version) => ({
          ...version,
          createdAt: iso(version.createdAt),
          updatedAt: iso(version.updatedAt),
          revisions: (revisionsByVersion.get(version.id) ?? []).map((revision) => ({
            id: revision.id,
            revisionNumber: revision.revisionNumber,
            source: revision.source,
            createdAt: iso(revision.createdAt),
          })),
        })),
      },
      jobs: {
        postings: jobPostings.map((job) => ({
          ...job,
          description: truncate(job.description, 400),
          createdAt: iso(job.createdAt),
        })),
        discovered: discoveredJobs.map((job) => ({ ...job, lastSeenAt: iso(job.lastSeenAt) })),
        queue: queueItems.map((item) => ({ ...item, updatedAt: iso(item.updatedAt) })),
      },
      applications: applications.map((application) => ({
        id: application.id,
        status: application.status,
        source: application.source,
        appliedAt: iso(application.appliedAt),
        lastActivityAt: iso(application.lastActivityAt),
        closedAt: iso(application.closedAt),
        events: (eventsByApplication.get(application.id) ?? []).map((event) => ({
          id: event.id,
          type: event.type,
          title: event.title,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          eventAt: iso(event.eventAt),
        })),
      })),
      communications: drafts.map((draft) => ({
        id: draft.id,
        type: draft.type,
        status: draft.status,
        usedAt: iso(draft.usedAt),
        createdAt: iso(draft.createdAt),
        applicationId: draft.applicationId,
      })),
      linkedin: {
        posts: linkedinPosts.map((post) => ({
          ...post,
          publishedAt: iso(post.publishedAt),
          createdAt: iso(post.createdAt),
          revisions: (revisionsByPost.get(post.id) ?? []).map((revision) => ({
            id: revision.id,
            revisionNumber: revision.revisionNumber,
            source: revision.source,
            qaStatus: revision.qaStatus,
            createdAt: iso(revision.createdAt),
          })),
          performances: (performancesByPost.get(post.id) ?? []).map((row) => ({
            ...row,
            capturedAt: iso(row.capturedAt),
          })),
        })),
        publishingPlans: linkedinPlans.map((plan) => ({ ...plan, publishedAt: iso(plan.publishedAt) })),
      },
      dailyRoadmap: {
        roadmaps: roadmaps.map((roadmap) => ({
          ...roadmap,
          actions: (actionsByRoadmap.get(roadmap.id) ?? []).map((action) => ({
            ...action,
            completedAt: iso(action.completedAt),
          })),
        })),
        activityDays,
      },
      weeklyReviews: reviews.map((review) => ({
        ...review,
        finalizedAt: iso(review.finalizedAt),
        metrics: metricsByReview.get(review.id) ?? [],
        insights: insightsByReview.get(review.id) ?? [],
        recommendations: (recommendationsByReview.get(review.id) ?? []).map((item) => ({
          ...item,
          adoptedAt: iso(item.adoptedAt),
        })),
      })),
      memory: {
        items: memories.map((memory) => ({
          ...memory,
          lastObservedAt: iso(memory.lastObservedAt),
          evidence: (evidenceByMemory.get(memory.id) ?? []).map((item) => ({
            id: item.id,
            sourceSubsystem: item.sourceSubsystem,
            evidenceType: item.evidenceType,
            observedAt: iso(item.observedAt),
            weight: item.weight,
          })),
        })),
        graph: { entities: graphEntities, relations: graphRelations },
      },
      settings: {
        skillsInsights,
        careerBriefs,
        reportSummary: report
          ? {
              generatedAt: report.generatedAt,
              careerHealth: report.careerHealth,
              jobsSummary: {
                savedJobsCount: report.jobsSummary.savedJobsCount,
                averageMatchScore: report.jobsSummary.averageMatchScore,
                bestMatchScore: report.jobsSummary.bestMatchScore,
              },
            }
          : null,
      },
    },
  };

  return stripExportSecrets(payload);
}
