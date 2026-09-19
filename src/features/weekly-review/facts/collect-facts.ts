import { prisma } from "@/server/db/prisma";

import { isScheduledCareerDay } from "@/features/daily-roadmap/lib/timezone";
import { getOrCreateDailyRoadmapPreference } from "@/features/daily-roadmap/preferences/preference-service";

import type { CareerWeekPeriod } from "../period/week-bounds";
import type { WeeklyCareerFacts, WeeklyFactCount } from "../types";

const POSITIVE_STAGE = new Set([
  "APPLIED",
  "SCREENING",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "ACCEPTED",
]);

const STAGE_RANK: Record<string, number> = {
  DRAFT: 0,
  APPLIED: 1,
  SCREENING: 2,
  ASSESSMENT: 3,
  INTERVIEW: 4,
  OFFER: 5,
  ACCEPTED: 6,
  REJECTED: 1,
  WITHDRAWN: 1,
};

const STRONG_DISCOVERY_BANDS = new Set(["EXCELLENT", "STRONG"]);

function count(ids: string[]): WeeklyFactCount {
  const unique = [...new Set(ids)];
  return { value: unique.length, ids: unique };
}

function inRange(value: Date | null | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const time = value.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

export async function collectWeeklyCareerFacts(
  userId: string,
  period: CareerWeekPeriod,
): Promise<WeeklyCareerFacts> {
  const { startUtc, endUtc, localDates, timezone } = period;
  const limitations: string[] = [];
  const preferences = await getOrCreateDailyRoadmapPreference(userId);
  const activeWeekdays = preferences.activeWeekdays;

  const [
    activityDays,
    roadmaps,
    activityRecords,
    applicationEvents,
    applicationsCreated,
    resumeVersions,
    resumeRevisions,
    communicationDrafts,
    discoveredJobs,
    queueItems,
    packages,
    jobRequirements,
    evidenceMatches,
    linkedinPosts,
    publishingPlans,
    performances,
    growthProfile,
    followUpDueEvents,
    resumesUsedInApplications,
  ] = await Promise.all([
    prisma.careerActivityDay.findMany({
      where: { userId, localDate: { in: localDates } },
    }),
    prisma.dailyRoadmap.findMany({
      where: { userId, localDate: { in: localDates } },
      include: { actions: true },
    }),
    prisma.careerActivityRecord.findMany({
      where: {
        userId,
        OR: [{ localDate: { in: localDates } }, { occurredAt: { gte: startUtc, lte: endUtc } }],
      },
    }),
    prisma.applicationEvent.findMany({
      where: { userId, eventAt: { gte: startUtc, lte: endUtc } },
      orderBy: { eventAt: "asc" },
    }),
    prisma.application.findMany({
      where: { userId, createdAt: { gte: startUtc, lte: endUtc } },
      select: { id: true, createdAt: true, status: true },
    }),
    prisma.resumeVersion.findMany({
      where: { userId, createdAt: { gte: startUtc, lte: endUtc } },
      select: { id: true, createdAt: true },
    }),
    prisma.resumeVersionRevision.findMany({
      where: { userId, createdAt: { gte: startUtc, lte: endUtc } },
      select: { id: true, createdAt: true },
    }),
    prisma.communicationDraft.findMany({
      where: {
        userId,
        OR: [
          { createdAt: { gte: startUtc, lte: endUtc } },
          { usedAt: { gte: startUtc, lte: endUtc } },
        ],
      },
      select: { id: true, type: true, status: true, createdAt: true, usedAt: true },
    }),
    prisma.discoveredJob.findMany({
      where: {
        userId,
        OR: [
          { firstSeenAt: { gte: startUtc, lte: endUtc } },
          { expiresAt: { gte: startUtc, lte: endUtc } },
          { dismissedAt: { gte: startUtc, lte: endUtc } },
        ],
      },
      select: {
        id: true,
        firstSeenAt: true,
        expiresAt: true,
        dismissedAt: true,
        scoreBand: true,
        discoveryStatus: true,
        jobPostingId: true,
      },
    }),
    prisma.applicationQueueItem.findMany({
      where: {
        userId,
        OR: [
          { queuedAt: { gte: startUtc, lte: endUtc } },
          { preparedAt: { gte: startUtc, lte: endUtc } },
          { handedOffAt: { gte: startUtc, lte: endUtc } },
        ],
      },
    }),
    prisma.applicationPackage.findMany({
      where: {
        userId,
        OR: [
          { preparedAt: { gte: startUtc, lte: endUtc } },
          { approvedAt: { gte: startUtc, lte: endUtc } },
          { createdAt: { gte: startUtc, lte: endUtc } },
        ],
      },
      select: {
        id: true,
        jobPostingId: true,
        applicationQueueItemId: true,
        readinessStatus: true,
        preparedAt: true,
        approvedAt: true,
      },
    }),
    prisma.jobRequirement.findMany({
      where: { userId, importance: { in: ["REQUIRED", "STRONGLY_PREFERRED"] } },
      select: { id: true, normalizedName: true, fingerprint: true, jobPostingId: true },
      take: 200,
    }),
    prisma.jobEvidenceMatch.findMany({
      where: { userId, createdAt: { gte: startUtc, lte: endUtc } },
      select: { id: true, jobRequirementId: true, createdAt: true },
    }),
    prisma.linkedinPost.findMany({
      where: {
        userId,
        OR: [
          { createdAt: { gte: startUtc, lte: endUtc } },
          { publishedAt: { gte: startUtc, lte: endUtc } },
        ],
      },
      select: { id: true, status: true, createdAt: true, publishedAt: true },
    }),
    prisma.linkedinPublishingPlan.findMany({
      where: {
        userId,
        OR: [
          { createdAt: { gte: startUtc, lte: endUtc } },
          { publishedAt: { gte: startUtc, lte: endUtc } },
          { plannedPublishAt: { gte: startUtc, lte: endUtc } },
        ],
      },
      select: { id: true, status: true, createdAt: true, publishedAt: true, plannedPublishAt: true },
    }),
    prisma.linkedinPostPerformance.findMany({
      where: { userId, capturedAt: { gte: startUtc, lte: endUtc } },
      select: { id: true, capturedAt: true, linkedinPostId: true },
    }),
    prisma.linkedinGrowthProfile.findFirst({ where: { userId }, select: { id: true } }),
    prisma.applicationEvent.findMany({
      where: {
        userId,
        type: "FOLLOW_UP_SCHEDULED",
        eventAt: { lte: endUtc },
      },
      select: { id: true, applicationId: true, eventAt: true, metadataJson: true },
    }),
    prisma.application.findMany({
      where: {
        userId,
        appliedAt: { gte: startUtc, lte: endUtc },
        resumeVersionId: { not: null },
      },
      select: { id: true, resumeVersionId: true },
    }),
  ]);

  const scheduledDays = localDates.filter((date) => isScheduledCareerDay(date, activeWeekdays)).length;
  const activeDays = activityDays.filter((day) => day.qualifiesForStreak).length;
  const meaningfulActions = activityRecords.filter((row) => row.meaningful).length;

  const coreActions = roadmaps.flatMap((roadmap) =>
    roadmap.actions.filter((action) => {
      const snapshot = action.contextSnapshotJson;
      const optional =
        snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
          ? Boolean((snapshot as Record<string, unknown>).optionalLater)
          : false;
      return !optional;
    }),
  );
  const coreMeaningfulPlanned = coreActions.filter((action) => action.isMeaningful && action.isActionable);
  const coreCompleted = coreMeaningfulPlanned.filter(
    (action) => action.status === "COMPLETED" && inRange(action.completedAt, startUtc, endUtc),
  );
  const deferred = coreActions.filter((action) => action.status === "DEFERRED").length;
  const skipped = coreActions.filter((action) => action.status === "SKIPPED").length;
  const carryOver = coreActions.filter((action) => action.origin === "CARRIED_OVER").length;
  const carryFingerprints = coreActions
    .filter((action) => action.origin === "CARRIED_OVER")
    .map((action) => action.fingerprint);
  const fingerprintCounts = new Map<string, number>();
  for (const fingerprint of carryFingerprints) {
    fingerprintCounts.set(fingerprint, (fingerprintCounts.get(fingerprint) ?? 0) + 1);
  }
  const repeatedIntentIds = [...fingerprintCounts.entries()]
    .filter(([, value]) => value >= 2)
    .map(([key]) => key);

  const plannedMinutes = roadmaps.reduce((sum, roadmap) => sum + roadmap.plannedMinutes, 0);
  const completedEstimatedMinutes = coreActions
    .filter((action) => action.status === "COMPLETED")
    .reduce((sum, action) => sum + action.estimatedMinutes, 0);

  const submitted = applicationEvents.filter(
    (event) =>
      event.type === "SUBMITTED" ||
      (event.type === "STATUS_CHANGED" && event.toStatus === "APPLIED"),
  );
  const stageProgressions = applicationEvents
    .filter((event) => event.type === "STATUS_CHANGED" && event.fromStatus && event.toStatus)
    .filter((event) => {
      const from = STAGE_RANK[event.fromStatus ?? ""] ?? 0;
      const to = STAGE_RANK[event.toStatus ?? ""] ?? 0;
      return POSITIVE_STAGE.has(event.toStatus ?? "") && to > from && event.toStatus !== "APPLIED";
    })
    .map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus ?? "UNKNOWN",
      toStatus: event.toStatus ?? "UNKNOWN",
    }));

  const followUpsCompleted = applicationEvents.filter((event) => event.type === "FOLLOW_UP_SENT");
  const followUpCleared = new Set(
    applicationEvents.filter((event) => event.type === "FOLLOW_UP_CLEARED").map((event) => event.applicationId),
  );
  const dueFollowUps = followUpDueEvents.filter((event) => {
    if (!inRange(event.eventAt, startUtc, endUtc)) return false;
    return !followUpCleared.has(event.applicationId);
  });
  const followUpDueReliable = true;

  const interviewRequired = applicationEvents.filter(
    (event) =>
      event.type === "INTERVIEW_SCHEDULED" ||
      event.type === "ASSESSMENT_SCHEDULED" ||
      event.type === "ASSESSMENT_RECEIVED",
  );
  const interviewPrep = activityRecords.filter(
    (row) => row.activityType === "INTERVIEW_PREP_COMPLETED" || row.activityType === "ASSESSMENT_PREP_COMPLETED",
  );

  const submittedIds = new Set(submitted.map((event) => event.applicationId));
  const readyPackages = packages.filter(
    (row) => row.readinessStatus === "READY" && inRange(row.preparedAt, startUtc, endUtc),
  );
  const actionableReadyCount = new Set([
    ...readyPackages.map((row) => row.id),
    ...submitted.map((event) => event.applicationId),
  ]).size;
  const activeSubmittedCohort = submittedIds.size + stageProgressions.length;

  const strongDiscovered = discoveredJobs.filter(
    (job) => inRange(job.firstSeenAt, startUtc, endUtc) && job.scoreBand && STRONG_DISCOVERY_BANDS.has(job.scoreBand),
  );
  const reviewedJobIds = new Set(
    coreCompleted
      .filter((action) => action.type === "JOB_REVIEW" && action.sourceEntityId)
      .map((action) => action.sourceEntityId as string),
  );
  const strongReviewed = strongDiscovered.filter(
    (job) => reviewedJobIds.has(job.id) || reviewedJobIds.has(job.jobPostingId ?? ""),
  );
  const strongPreparedJobs = queueItems.filter(
    (item) => inRange(item.preparedAt, startUtc, endUtc),
  );
  const handedOff = queueItems.filter((item) => inRange(item.handedOffAt, startUtc, endUtc));
  const readyToApply = packages.filter(
    (row) => row.readinessStatus === "READY" && inRange(row.preparedAt ?? row.approvedAt, startUtc, endUtc),
  );
  const expiredUnacted = discoveredJobs.filter((job) => {
    if (!inRange(job.expiresAt, startUtc, endUtc)) return false;
    if (!job.scoreBand || !STRONG_DISCOVERY_BANDS.has(job.scoreBand)) return false;
    const prepared = queueItems.some((item) => item.discoveredJobId === job.id && item.preparedAt);
    return !prepared && !job.dismissedAt;
  });

  const resumeReady = activityRecords.filter((row) => row.activityType === "RESUME_READY");
  const resumeUsed = resumesUsedInApplications;
  if (resumeReady.length === 0) {
    limitations.push("Resume READY is counted only from M26 RESUME_READY activity records; updatedAt is not used.");
  }

  const usedComms = communicationDrafts.filter((draft) => inRange(draft.usedAt, startUtc, endUtc));
  limitations.push("Communication READY transitions are omitted because no dedicated readyAt timestamp exists.");

  const publishedPlans = publishingPlans.filter((plan) => inRange(plan.publishedAt, startUtc, endUtc));
  const publishedPosts = linkedinPosts.filter((post) => inRange(post.publishedAt, startUtc, endUtc));
  const publishedIds = count([
    ...publishedPlans.map((plan) => plan.id),
    ...publishedPosts.map((post) => post.id),
  ]);
  const readyPlans = publishingPlans.filter((plan) => {
    const createdOrDue = inRange(plan.createdAt, startUtc, endUtc) || inRange(plan.plannedPublishAt, startUtc, endUtc);
    if (!createdOrDue) return false;
    return plan.publishedAt === null || (plan.publishedAt !== null && plan.publishedAt.getTime() > endUtc.getTime());
  });
  const visibilityGapActions = coreCompleted.filter(
    (action) => action.type === "PROFILE_IMPROVEMENT" || action.type === "LINKEDIN_POST_REVIEW",
  );
  const profileImprovement = coreCompleted.filter((action) => action.type === "PROFILE_IMPROVEMENT");
  if (!period.isCurrent) {
    limitations.push("Current LinkedIn visibility-gap inventory is not injected into historical weeks.");
  }

  const skillCompleted = coreCompleted.filter((action) => action.type === "SKILL_DEVELOPMENT");
  const evidenceCompleted = coreCompleted.filter((action) => action.type === "EVIDENCE_BUILDING");
  const skillPlanned = coreMeaningfulPlanned.filter(
    (action) => action.type === "SKILL_DEVELOPMENT" || action.type === "EVIDENCE_BUILDING",
  );

  const requirementCounts = new Map<string, number>();
  for (const requirement of jobRequirements) {
    const key = requirement.normalizedName.toLowerCase();
    requirementCounts.set(key, (requirementCounts.get(key) ?? 0) + 1);
  }
  const recurringNames = [...requirementCounts.entries()].filter(([, value]) => value >= 2).map(([key]) => key);
  const addressedRequirementIds = new Set(evidenceMatches.map((row) => row.jobRequirementId));
  const addressedRecurring = jobRequirements.filter(
    (requirement) =>
      recurringNames.includes(requirement.normalizedName.toLowerCase()) && addressedRequirementIds.has(requirement.id),
  );
  const remainingGaps = recurringNames.filter(
    (name) =>
      !jobRequirements.some(
        (requirement) =>
          requirement.normalizedName.toLowerCase() === name && addressedRequirementIds.has(requirement.id),
      ),
  );

  return {
    period: {
      weekStartLocalDate: period.weekStartLocalDate,
      weekEndLocalDate: period.weekEndLocalDate,
      timezone,
      isComplete: period.isComplete,
      isCurrent: period.isCurrent,
    },
    preferences: {
      includeLinkedIn: preferences.includeLinkedIn,
      includeSkillDevelopment: preferences.includeSkillDevelopment,
      activeWeekdays,
      hasLinkedinProfile: Boolean(growthProfile),
    },
    execution: {
      scheduledDays,
      activeDays,
      meaningfulActions,
      corePlanned: coreMeaningfulPlanned.length,
      coreCompleted: coreCompleted.length,
      deferred,
      skipped,
      carryOver,
      repeatedCarryOverIntents: repeatedIntentIds.length,
      plannedMinutes,
      completedEstimatedMinutes,
      repeatedIntentIds,
    },
    applications: {
      created: count(applicationsCreated.map((row) => row.id)),
      submitted: count(submitted.map((event) => event.applicationId)),
      stageProgressions,
      followUpsDue: count(dueFollowUps.map((event) => event.id)),
      followUpsCompleted: count(followUpsCompleted.map((event) => event.id)),
      interviewAssessmentRequired: count(interviewRequired.map((event) => event.applicationId)),
      interviewAssessmentPrep: count(interviewPrep.map((row) => row.id)),
      actionableReadyCount,
      activeSubmittedCohort,
      followUpDueReliable,
    },
    opportunities: {
      strongDiscovered: count(strongDiscovered.map((job) => job.id)),
      strongReviewed: count(strongReviewed.map((job) => job.id)),
      strongPrepared: count(strongPreparedJobs.map((item) => item.id)),
      readyToApply: count(readyToApply.map((row) => row.id)),
      handedOff: count(handedOff.map((item) => item.id)),
      expiredUnacted: count(expiredUnacted.map((job) => job.id)),
      strongActionable: strongDiscovered.length,
    },
    resume: {
      versionsCreated: count(resumeVersions.map((row) => row.id)),
      revisionsCreated: count(resumeRevisions.map((row) => row.id)),
      ready: count(resumeReady.map((row) => row.id)),
      used: count(resumeUsed.map((row) => row.id)),
    },
    communication: {
      created: count(communicationDrafts.filter((draft) => inRange(draft.createdAt, startUtc, endUtc)).map((draft) => draft.id)),
      used: count(usedComms.map((draft) => draft.id)),
      followUpUsed: count(usedComms.filter((draft) => draft.type === "FOLLOW_UP").map((draft) => draft.id)),
      interviewThankYouUsed: count(
        usedComms.filter((draft) => draft.type === "INTERVIEW_THANK_YOU").map((draft) => draft.id),
      ),
      recruiterOutreachUsed: count(
        usedComms.filter((draft) => draft.type === "RECRUITER_OUTREACH").map((draft) => draft.id),
      ),
    },
    linkedin: {
      ready: count(readyPlans.map((plan) => plan.id)),
      published: publishedIds,
      readyUnpublished: count(readyPlans.filter((plan) => !inRange(plan.publishedAt, startUtc, endUtc)).map((plan) => plan.id)),
      performanceSnapshots: count(performances.map((row) => row.id)),
      visibilityGapActions: count(visibilityGapActions.map((action) => action.id)),
      profileImprovementActions: count(profileImprovement.map((action) => action.id)),
    },
    skillsEvidence: {
      skillActionsCompleted: count(skillCompleted.map((action) => action.id)),
      evidenceActionsCompleted: count(evidenceCompleted.map((action) => action.id)),
      skillActionsPlanned: skillPlanned.length,
      recurringGapsAddressed: count(addressedRecurring.map((row) => row.id)),
      remainingGaps,
    },
    limitations,
  };
}
