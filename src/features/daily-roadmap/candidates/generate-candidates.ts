import { prisma } from "@/server/db/prisma";

import { candidateFingerprint } from "../lib/fingerprint";
import { getCareerLocalDate, addLocalDays, compareLocalDates } from "../lib/timezone";
import { parseStringArray } from "../lib/json";
import { isMeaningfulActionType } from "../activity/classifier";
import { getSafeLinkedinConnection } from "@/features/linkedin/server";
import { loadAdoptedWeeklyHandoffCandidates } from "@/features/weekly-review/handoff/adopted-candidates";
import type {
  DailyActionCandidate,
  DailyActionCategory,
  DailyRoadmapActionType,
  DailyRoadmapPreferenceView,
  DailyRoadmapSourceEntityType,
  EstimatedMinuteBucket,
} from "../types";
import { MAX_RAW_CANDIDATES } from "../types";

const TERMINAL_APPLICATION_STATUSES = ["ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
const APPLIED_OR_LATER = [
  "APPLIED",
  "SCREENING",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "ACCEPTED",
] as const;

type CandidateInput = {
  type: DailyRoadmapActionType;
  sourceEntityType: DailyRoadmapSourceEntityType;
  sourceEntityId: string | null;
  intent: string;
  title: string;
  summary?: string | null;
  whyNowFacts: string[];
  estimatedMinutes?: EstimatedMinuteBucket;
  isActionable?: boolean;
  blockedReason?: string | null;
  urgencySignals?: string[];
  impactSignals?: string[];
  readinessSignals?: string[];
  opportunityQualitySignals?: string[];
  neglectSignals?: string[];
  efficiencySignals?: string[];
  deepLink: string | null;
  category: DailyActionCategory;
  contextSnapshot?: Record<string, unknown>;
  origin?: DailyActionCandidate["origin"];
};

function candidate(input: CandidateInput): DailyActionCandidate {
  return {
    type: input.type,
    origin: input.origin ?? "SYSTEM_GENERATED",
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    title: input.title,
    summary: input.summary ?? null,
    whyNowFacts: input.whyNowFacts,
    estimatedMinutes: input.estimatedMinutes ?? 15,
    isMeaningful: isMeaningfulActionType(input.type),
    isActionable: input.isActionable ?? true,
    blockedReason: input.blockedReason ?? null,
    urgencySignals: input.urgencySignals ?? [],
    impactSignals: input.impactSignals ?? [],
    readinessSignals: input.readinessSignals ?? ["actionable now"],
    opportunityQualitySignals: input.opportunityQualitySignals ?? [],
    neglectSignals: input.neglectSignals ?? [],
    efficiencySignals: input.efficiencySignals ?? [],
    deepLink: input.deepLink,
    fingerprint: candidateFingerprint({
      type: input.type,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      intent: input.intent,
    }),
    contextSnapshot: input.contextSnapshot ?? {},
    category: input.category,
  };
}

function isExpired(expiresAt: Date | null, now: Date): boolean {
  return Boolean(expiresAt && expiresAt.getTime() < now.getTime());
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export async function generateDailyActionCandidates(input: {
  userId: string;
  preferences: DailyRoadmapPreferenceView;
  now?: Date;
}): Promise<DailyActionCandidate[]> {
  const now = input.now ?? new Date();
  const today = getCareerLocalDate(now, input.preferences.timezone);
  const tomorrow = addLocalDays(today, 1);
  const windowStart = new Date(now.getTime() - 21 * 86_400_000);
  const collected: DailyActionCandidate[] = [];

  const [
    discoveredJobs,
    queueItems,
    packages,
    applications,
    resumeVersions,
    drafts,
    publishingPlans,
    linkedinPosts,
    connection,
    discoveryProfile,
    latestInsight,
    growthProfile,
  ] = await Promise.all([
    prisma.discoveredJob.findMany({
      where: {
        userId: input.userId,
        discoveryStatus: "CANDIDATE",
        dismissedAt: null,
        lastSeenAt: { gte: windowStart },
      },
      orderBy: [{ finalScore: "desc" }, { lastSeenAt: "desc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        company: true,
        finalScore: true,
        scoreBand: true,
        postedAt: true,
        expiresAt: true,
        jobPostingId: true,
        hardBlockersJson: true,
        missingSkillsJson: true,
        lastSeenAt: true,
      },
    }),
    prisma.applicationQueueItem.findMany({
      where: { userId: input.userId, queueStatus: { in: ["QUEUED", "PREPARING", "HANDED_OFF"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { discoveredJob: { select: { id: true, title: true, company: true, expiresAt: true, jobPostingId: true, finalScore: true } } },
    }),
    prisma.applicationPackage.findMany({
      where: { userId: input.userId, status: { notIn: ["ARCHIVED", "SUBMITTED"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        jobPosting: { select: { id: true, title: true, company: true } },
        resumeVersion: { select: { id: true, status: true, title: true } },
      },
    }),
    prisma.application.findMany({
      where: { userId: input.userId },
      orderBy: [{ lastActivityAt: "desc" }, { updatedAt: "desc" }],
      take: 30,
      select: {
        id: true,
        status: true,
        jobPostingId: true,
        followUpAt: true,
        lastActivityAt: true,
        nextActionType: true,
        nextActionTitle: true,
        nextActionReason: true,
        nextActionDueAt: true,
        resumeVersionId: true,
        resumeVersion: { select: { id: true, status: true, title: true } },
        jobPosting: { select: { id: true, title: true, company: true } },
        events: {
          where: {
            type: { in: ["INTERVIEW_SCHEDULED", "ASSESSMENT_SCHEDULED", "ASSESSMENT_RECEIVED", "OFFER_RECEIVED"] },
            eventAt: { gte: new Date(now.getTime() - 86_400_000), lte: new Date(now.getTime() + 14 * 86_400_000) },
          },
          orderBy: { eventAt: "asc" },
          take: 3,
          select: { type: true, eventAt: true, title: true },
        },
      },
    }),
    prisma.resumeVersion.findMany({
      where: { userId: input.userId, status: { in: ["DRAFT", "READY"] }, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { id: true, title: true, status: true, activeRevisionId: true, targetJobId: true },
    }),
    prisma.communicationDraft.findMany({
      where: {
        userId: input.userId,
        archivedAt: null,
        status: { in: ["DRAFT", "READY"] },
        type: { in: ["FOLLOW_UP", "INTERVIEW_THANK_YOU", "RECRUITER_OUTREACH", "APPLICATION_EMAIL", "POST_INTERVIEW_FOLLOW_UP", "OFFER_RESPONSE"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: {
        id: true,
        type: true,
        status: true,
        applicationId: true,
        application: { select: { id: true, status: true, jobPosting: { select: { title: true, company: true } } } },
      },
    }),
    prisma.linkedinPublishingPlan.findMany({
      where: { userId: input.userId, status: { in: ["READY", "SCHEDULED"] } },
      orderBy: [{ plannedPublishAt: "asc" }, { updatedAt: "desc" }],
      take: 8,
      include: { linkedinPost: { select: { id: true, status: true } } },
    }),
    prisma.linkedinPost.findMany({
      where: { userId: input.userId, status: { in: ["DRAFT", "READY", "PUBLISHED"] } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, status: true, objective: true, publishedAt: true, activeRevisionId: true },
    }),
    getSafeLinkedinConnection(input.userId),
    prisma.jobDiscoveryProfile.findUnique({ where: { userId: input.userId } }),
    prisma.skillsInsight.findFirst({ where: { userId: input.userId }, orderBy: { createdAt: "desc" } }),
    prisma.linkedinGrowthProfile.findFirst({ where: { userId: input.userId, status: "ACTIVE" } }),
  ]);

  const appliedJobIds = new Set(
    applications
      .filter((application) => (APPLIED_OR_LATER as readonly string[]).includes(application.status))
      .map((application) => application.jobPostingId)
      .filter((id): id is string => Boolean(id)),
  );

  const analyses = await prisma.jobOpportunityAnalysis.findMany({
    where: {
      userId: input.userId,
      jobPostingId: {
        in: [
          ...discoveredJobs.map((job) => job.jobPostingId).filter((id): id is string => Boolean(id)),
          ...packages.map((item) => item.jobPostingId).filter((id): id is string => Boolean(id)),
        ],
      },
    },
    take: 30,
  });
  const analysisByJob = new Map(analyses.map((row) => [row.jobPostingId, row]));

  for (const job of discoveredJobs) {
    if (isExpired(job.expiresAt, now)) continue;
    if (job.jobPostingId && appliedJobIds.has(job.jobPostingId)) continue;
    const blockers = parseStringArray(job.hardBlockersJson);
    const analysis = job.jobPostingId ? analysisByJob.get(job.jobPostingId) : undefined;
    const ineligible =
      analysis?.eligibilityStatus === "INELIGIBLE" || analysis?.eligibilityStatus === "LIKELY_INELIGIBLE";
    const queued = queueItems.some((item) => item.discoveredJobId === job.id);
    const relatedPackage = packages.find((item) => item.jobPostingId && item.jobPostingId === job.jobPostingId);
    const readyToApply =
      relatedPackage?.readinessStatus === "READY" &&
      (relatedPackage.status === "READY_FOR_REVIEW" || relatedPackage.status === "APPROVED") &&
      !ineligible &&
      blockers.length === 0 &&
      analysis?.recommendation !== "SKIP";

    if (readyToApply && relatedPackage) {
      collected.push(
        candidate({
          type: "JOB_APPLY",
          sourceEntityType: "JOB",
          sourceEntityId: job.jobPostingId ?? job.id,
          intent: "apply",
          title: `Apply to ${job.company}`,
          summary: job.title,
          whyNowFacts: ["This opportunity is ready to apply according to the current application package."],
          estimatedMinutes: 30,
          impactSignals: ["application progression"],
          opportunityQualitySignals: job.finalScore != null ? [`stored suitability ${job.finalScore}`] : [],
          readinessSignals: ["application package ready"],
          deepLink: `/workspace/jobs/apply-now/${relatedPackage.id}`,
          category: "jobs",
          contextSnapshot: {
            discoveredJobId: job.id,
            jobPostingId: job.jobPostingId,
            packageId: relatedPackage.id,
            finalScore: job.finalScore,
            opportunityScore: analysis?.opportunityScore ?? null,
          },
        }),
      );
      continue;
    }

    if (queued || (relatedPackage && relatedPackage.readinessStatus !== "READY")) {
      const resumeBlocked = relatedPackage?.resumeVersion?.status === "DRAFT";
      collected.push(
        candidate({
          type: "JOB_PREPARE",
          sourceEntityType: "JOB",
          sourceEntityId: job.jobPostingId ?? job.id,
          intent: "prepare",
          title: `Prepare application for ${job.company}`,
          summary: job.title,
          whyNowFacts: resumeBlocked
            ? ["Resume review is blocking application preparation."]
            : ["This opportunity is active and still needs application preparation."],
          estimatedMinutes: 45,
          isActionable: !ineligible,
          blockedReason: ineligible ? "Eligibility is blocked for this opportunity." : null,
          impactSignals: ["high-value preparation step"],
          opportunityQualitySignals: job.finalScore != null ? [`stored suitability ${job.finalScore}`] : [],
          deepLink: "/workspace/jobs/queue",
          category: "jobs",
          contextSnapshot: {
            discoveredJobId: job.id,
            queueItemId: queueItems.find((item) => item.discoveredJobId === job.id)?.id ?? null,
            packageId: relatedPackage?.id ?? null,
            finalScore: job.finalScore,
          },
        }),
      );
      if (resumeBlocked && relatedPackage?.resumeVersionId) {
        collected.push(
          candidate({
            type: "RESUME_REVIEW",
            sourceEntityType: "RESUME_VERSION",
            sourceEntityId: relatedPackage.resumeVersionId,
            intent: "ready-resume",
            title: `Review resume · ${relatedPackage.resumeVersion?.title ?? "Version"}`,
            whyNowFacts: ["Resume review is blocking application preparation."],
            estimatedMinutes: 30,
            impactSignals: ["application preparation blocker"],
            deepLink: `/workspace/resume/versions/${relatedPackage.resumeVersionId}`,
            category: "jobs",
            contextSnapshot: { packageId: relatedPackage.id, jobPostingId: relatedPackage.jobPostingId },
          }),
        );
      }
      continue;
    }

    if ((job.finalScore ?? 0) >= 75) {
      collected.push(
        candidate({
          type: "JOB_REVIEW",
          sourceEntityType: "JOB",
          sourceEntityId: job.id,
          intent: "review",
          title: `Review ${job.company} · ${job.title}`,
          whyNowFacts: [
            job.postedAt && daysBetween(job.postedAt, now) <= 3
              ? "High-fit opportunity posted recently."
              : "High-fit opportunity is still active and has not been meaningfully reviewed.",
          ],
          estimatedMinutes: 10,
          opportunityQualitySignals: [`stored suitability ${job.finalScore}`],
          deepLink: job.jobPostingId ? "/workspace/jobs" : "/workspace/jobs/discover",
          category: "jobs",
          contextSnapshot: { discoveredJobId: job.id, jobPostingId: job.jobPostingId, finalScore: job.finalScore },
        }),
      );
    }
  }

  for (const item of queueItems) {
    if (isExpired(item.discoveredJob.expiresAt, now)) continue;
    if (item.discoveredJob.jobPostingId && appliedJobIds.has(item.discoveredJob.jobPostingId)) continue;
    if (collected.some((row) => row.contextSnapshot.discoveredJobId === item.discoveredJobId)) continue;
    const relatedPackage = packages.find((pkg) => pkg.applicationQueueItemId === item.id);
    if (relatedPackage?.readinessStatus === "READY") {
      collected.push(
        candidate({
          type: "JOB_APPLY",
          sourceEntityType: "JOB",
          sourceEntityId: item.discoveredJob.jobPostingId ?? item.discoveredJobId,
          intent: "apply",
          title: `Apply to ${item.discoveredJob.company}`,
          summary: item.discoveredJob.title,
          whyNowFacts: ["This opportunity is ready to apply according to the current application package."],
          estimatedMinutes: 30,
          deepLink: `/workspace/jobs/apply-now/${relatedPackage.id}`,
          category: "jobs",
          contextSnapshot: { queueItemId: item.id, packageId: relatedPackage.id, finalScore: item.discoveredJob.finalScore },
        }),
      );
    } else {
      collected.push(
        candidate({
          type: "JOB_PREPARE",
          sourceEntityType: "JOB",
          sourceEntityId: item.discoveredJob.jobPostingId ?? item.discoveredJobId,
          intent: "prepare",
          title: `Prepare application for ${item.discoveredJob.company}`,
          whyNowFacts: ["This opportunity is active and still needs application preparation."],
          estimatedMinutes: 45,
          deepLink: "/workspace/jobs/queue",
          category: "jobs",
          contextSnapshot: { queueItemId: item.id, discoveredJobId: item.discoveredJobId },
        }),
      );
    }
  }

  for (const application of applications) {
    const company = application.jobPosting?.company ?? "this role";
    const title = application.jobPosting?.title ?? "Application";
    const terminal = (TERMINAL_APPLICATION_STATUSES as readonly string[]).includes(application.status);
    const dueLocal = application.nextActionDueAt
      ? getCareerLocalDate(application.nextActionDueAt, input.preferences.timezone)
      : null;
    const followLocal = application.followUpAt
      ? getCareerLocalDate(application.followUpAt, input.preferences.timezone)
      : null;
    const overdue =
      Boolean(dueLocal && compareLocalDates(dueLocal, today) < 0) ||
      Boolean(followLocal && compareLocalDates(followLocal, today) < 0);
    const dueToday = dueLocal === today || followLocal === today;
    const dueTomorrow = dueLocal === tomorrow || followLocal === tomorrow;
    const interviewEvent = application.events.find((event) => event.type === "INTERVIEW_SCHEDULED");
    const assessmentEvent = application.events.find(
      (event) => event.type === "ASSESSMENT_SCHEDULED" || event.type === "ASSESSMENT_RECEIVED",
    );
    const offerEvent = application.events.find((event) => event.type === "OFFER_RECEIVED") ?? application.status === "OFFER";

    if (terminal && !application.nextActionType) continue;

    if (interviewEvent) {
      const eventDay = getCareerLocalDate(interviewEvent.eventAt, input.preferences.timezone);
      collected.push(
        candidate({
          type: "INTERVIEW_PREP",
          sourceEntityType: "APPLICATION",
          sourceEntityId: application.id,
          intent: "interview-prep",
          title: `Prepare interview · ${company}`,
          summary: title,
          whyNowFacts:
            eventDay === today || eventDay === tomorrow
              ? ["Interview is scheduled soon."]
              : ["An interview is on the application timeline."],
          estimatedMinutes: 60,
          urgencySignals: eventDay === today ? ["interview today"] : eventDay === tomorrow ? ["interview tomorrow"] : ["interview soon"],
          impactSignals: ["application/interview progression"],
          deepLink: `/workspace/applications/${application.id}`,
          category: "applications",
          contextSnapshot: { applicationStatus: application.status, eventAt: interviewEvent.eventAt.toISOString() },
        }),
      );
    }

    if (assessmentEvent || application.status === "ASSESSMENT" || application.nextActionType === "PREPARE_ASSESSMENT") {
      const eventDay = assessmentEvent
        ? getCareerLocalDate(assessmentEvent.eventAt, input.preferences.timezone)
        : dueLocal;
      collected.push(
        candidate({
          type: "ASSESSMENT_PREP",
          sourceEntityType: "APPLICATION",
          sourceEntityId: application.id,
          intent: "assessment-prep",
          title: `Prepare assessment · ${company}`,
          whyNowFacts: eventDay === today ? ["Assessment is due today."] : ["An assessment is on the application timeline."],
          estimatedMinutes: 60,
          urgencySignals: eventDay === today ? ["assessment due today"] : ["assessment soon"],
          impactSignals: ["application/interview progression"],
          deepLink: `/workspace/applications/${application.id}`,
          category: "applications",
          contextSnapshot: { applicationStatus: application.status },
        }),
      );
    }

    if (offerEvent || application.nextActionType === "REVIEW_OFFER") {
      collected.push(
        candidate({
          type: "APPLICATION_NEXT_STEP",
          sourceEntityType: "APPLICATION",
          sourceEntityId: application.id,
          intent: "offer-response",
          title: `Review offer · ${company}`,
          whyNowFacts: ["An offer response is on the application timeline."],
          estimatedMinutes: 45,
          urgencySignals: dueToday ? ["offer response due"] : [],
          impactSignals: ["application/interview progression"],
          deepLink: `/workspace/applications/${application.id}`,
          category: "applications",
          contextSnapshot: { applicationStatus: application.status },
        }),
      );
    }

    if (
      !terminal &&
      (application.nextActionType === "FOLLOW_UP" || application.followUpAt || application.nextActionType === "CONTACT_RECRUITER")
    ) {
      collected.push(
        candidate({
          type: "APPLICATION_FOLLOW_UP",
          sourceEntityType: "APPLICATION",
          sourceEntityId: application.id,
          intent: "follow-up",
          title: `Follow up · ${company}`,
          summary: application.nextActionTitle,
          whyNowFacts: overdue
            ? ["Follow-up is due according to the application timeline."]
            : ["A follow-up is scheduled on the application timeline."],
          estimatedMinutes: 15,
          urgencySignals: overdue ? ["follow-up overdue"] : dueToday ? ["follow-up due today"] : [],
          neglectSignals: overdue || daysBetween(application.lastActivityAt, now) >= 7 ? ["application activity neglected"] : [],
          deepLink: `/workspace/applications/${application.id}`,
          category: "follow_up",
          contextSnapshot: {
            applicationStatus: application.status,
            nextActionType: application.nextActionType,
            nextActionDueAt: application.nextActionDueAt?.toISOString() ?? null,
          },
        }),
      );
    } else if (!terminal && application.nextActionType && application.nextActionType !== "WAIT") {
      if (application.nextActionType === "UPDATE_RESUME" && application.resumeVersionId) {
        collected.push(
          candidate({
            type: "RESUME_REVIEW",
            sourceEntityType: "RESUME_VERSION",
            sourceEntityId: application.resumeVersionId,
            intent: "application-resume",
            title: `Review resume · ${application.resumeVersion?.title ?? "Version"}`,
            whyNowFacts: ["Resume review is blocking application preparation."],
            estimatedMinutes: 30,
            deepLink: `/workspace/resume/versions/${application.resumeVersionId}`,
            category: "jobs",
          }),
        );
      } else if (application.nextActionType === "SUBMIT_APPLICATION") {
        collected.push(
          candidate({
            type: "JOB_APPLY",
            sourceEntityType: "APPLICATION",
            sourceEntityId: application.id,
            intent: "submit",
            title: `Apply to ${company}`,
            whyNowFacts: ["The application tracker lists submission as the next action."],
            estimatedMinutes: 30,
            isActionable: application.status === "DRAFT",
            deepLink: `/workspace/applications/${application.id}`,
            category: "jobs",
            contextSnapshot: { applicationStatus: application.status },
          }),
        );
      } else if (!interviewEvent && application.nextActionType !== "PREPARE_ASSESSMENT" && application.nextActionType !== "REVIEW_OFFER") {
        collected.push(
          candidate({
            type: "APPLICATION_NEXT_STEP",
            sourceEntityType: "APPLICATION",
            sourceEntityId: application.id,
            intent: application.nextActionType,
            title: application.nextActionTitle ?? `Next step · ${company}`,
            whyNowFacts: [application.nextActionReason ?? "The application tracker has a stored next action."],
            estimatedMinutes: 15,
            deepLink: `/workspace/applications/${application.id}`,
            category: "applications",
            contextSnapshot: { applicationStatus: application.status, nextActionType: application.nextActionType },
          }),
        );
      }
    }

    void dueTomorrow;
  }

  for (const draft of drafts) {
    const company = draft.application?.jobPosting?.company;
    collected.push(
      candidate({
        type: "COMMUNICATION_REVIEW",
        sourceEntityType: "COMMUNICATION",
        sourceEntityId: draft.id,
        intent: "review-draft",
        title: company ? `Review ${draft.type.replaceAll("_", " ").toLowerCase()} · ${company}` : "Review communication draft",
        whyNowFacts:
          draft.status === "READY"
            ? ["A communication draft is ready for the current application workflow."]
            : ["An actionable communication draft is waiting for review."],
        estimatedMinutes: 15,
        deepLink: `/workspace/communications/${draft.id}`,
        category: "follow_up",
        contextSnapshot: { communicationType: draft.type, communicationStatus: draft.status, applicationId: draft.applicationId },
      }),
    );
  }

  if (input.preferences.includeLinkedIn) {
    const reauth = connection.reauthRequired || connection.status === "REAUTH_REQUIRED";
    const publishCapability = connection.capabilities.find((item) => item.capability === "PUBLISH_MEMBER_POST");
    const publishBlockedByReauth = reauth || publishCapability?.recoveryAction === "RECONNECT";

    if (publishBlockedByReauth && publishingPlans.length > 0) {
      collected.push(
        candidate({
          type: "LINKEDIN_RECONNECT",
          sourceEntityType: "LINKEDIN_PLAN",
          sourceEntityId: publishingPlans[0]?.id ?? null,
          intent: "reconnect",
          title: "Reconnect LinkedIn",
          whyNowFacts: ["LinkedIn authorization needs renewal before official publishing can continue."],
          estimatedMinutes: 10,
          isActionable: true,
          blockedReason: "LinkedIn authorization needs renewal.",
          deepLink: "/workspace/linkedin/settings",
          category: "linkedin",
        }),
      );
    }

    for (const plan of publishingPlans) {
      if (plan.linkedinPost.status === "PUBLISHED") continue;
      const plannedDay = plan.plannedPublishAt
        ? getCareerLocalDate(plan.plannedPublishAt, input.preferences.timezone)
        : null;
      if (publishBlockedByReauth) continue;
      collected.push(
        candidate({
          type: "LINKEDIN_PUBLISH",
          sourceEntityType: "LINKEDIN_PLAN",
          sourceEntityId: plan.id,
          intent: "publish",
          title: "Publish LinkedIn post",
          whyNowFacts:
            plannedDay === today
              ? ["LinkedIn publishing plan is scheduled for today."]
              : ["LinkedIn publishing plan is ready."],
          estimatedMinutes: 15,
          urgencySignals: plannedDay === today ? ["scheduled publish timing"] : [],
          impactSignals: ["LinkedIn positioning goal"],
          deepLink: `/workspace/linkedin/publish/${plan.id}`,
          category: "linkedin",
          contextSnapshot: { linkedinPostId: plan.linkedinPostId, planStatus: plan.status },
        }),
      );
    }

    for (const post of linkedinPosts) {
      if (post.status === "DRAFT" && post.activeRevisionId) {
        collected.push(
          candidate({
            type: "LINKEDIN_POST_REVIEW",
            sourceEntityType: "LINKEDIN_POST",
            sourceEntityId: post.id,
            intent: "review-post",
            title: "Review LinkedIn post",
            whyNowFacts: ["A LinkedIn draft is waiting for review before it can be published."],
            estimatedMinutes: 15,
            deepLink: `/workspace/linkedin/posts/${post.id}`,
            category: "linkedin",
          }),
        );
      }
    }
  }

  if (input.preferences.includeSkillDevelopment) {
    const prioritySkills = Array.isArray(latestInsight?.prioritySkills) ? latestInsight.prioritySkills : [];
    for (const skill of prioritySkills.slice(0, 4)) {
      if (!skill || typeof skill !== "object") continue;
      const record = skill as Record<string, unknown>;
      const name = typeof record.skill === "string" ? record.skill : typeof record.name === "string" ? record.name : null;
      if (!name) continue;
      const evidence = typeof record.evidenceStatus === "string" ? record.evidenceStatus : "";
      const hasEvidence = evidence === "supported" || evidence === "partially_supported";
      collected.push(
        candidate({
          type: hasEvidence ? "SKILL_DEVELOPMENT" : "EVIDENCE_BUILDING",
          sourceEntityType: "SKILL",
          sourceEntityId: name.toLowerCase(),
          intent: hasEvidence ? "develop" : "evidence",
          title: hasEvidence ? `Develop ${name}` : `Build evidence for ${name}`,
          whyNowFacts: hasEvidence
            ? ["Target roles repeatedly request this skill."]
            : ["This action addresses an existing evidence gap."],
          estimatedMinutes: 45,
          impactSignals: ["important evidence gap"],
          deepLink: "/workspace/skills",
          category: "skills",
          contextSnapshot: { skill: name, evidenceStatus: evidence },
        }),
      );
    }

    const missingFromJobs = discoveredJobs.flatMap((job) => parseStringArray(job.missingSkillsJson)).slice(0, 3);
    for (const name of missingFromJobs) {
      if (collected.some((row) => row.sourceEntityId === name.toLowerCase() && row.sourceEntityType === "SKILL")) continue;
      collected.push(
        candidate({
          type: "EVIDENCE_BUILDING",
          sourceEntityType: "SKILL",
          sourceEntityId: name.toLowerCase(),
          intent: "evidence",
          title: `Build evidence for ${name}`,
          whyNowFacts: ["This action addresses an existing evidence gap."],
          estimatedMinutes: 45,
          deepLink: "/workspace/skills",
          category: "skills",
          contextSnapshot: { skill: name, source: "discovered-job-gap" },
        }),
      );
    }
  }

  if (!growthProfile && input.preferences.includeLinkedIn) {
    collected.push(
      candidate({
        type: "PROFILE_IMPROVEMENT",
        sourceEntityType: "CAREER_CONTEXT",
        sourceEntityId: null,
        intent: "linkedin-strategy",
        title: "Build LinkedIn strategy",
        whyNowFacts: ["No active LinkedIn strategy is stored yet."],
        estimatedMinutes: 15,
        deepLink: "/workspace/linkedin/strategy",
        category: "setup",
      }),
    );
  }

  const roleTargets = Array.isArray(discoveryProfile?.roleTargetsJson)
    ? discoveryProfile.roleTargetsJson
    : [];
  if (!discoveryProfile || roleTargets.length === 0) {
    collected.push(
      candidate({
        type: "JOB_REVIEW",
        sourceEntityType: "CAREER_CONTEXT",
        sourceEntityId: null,
        intent: "target-roles",
        title: "Set target roles",
        whyNowFacts: ["Target roles are not stored yet, so Today cannot prioritize job search work."],
        estimatedMinutes: 10,
        deepLink: "/workspace/jobs/discover",
        category: "setup",
      }),
    );
  }

  if (discoveredJobs.length === 0 && applications.length === 0) {
    collected.push(
      candidate({
        type: "JOB_REVIEW",
        sourceEntityType: "CAREER_CONTEXT",
        sourceEntityId: null,
        intent: "discover-jobs",
        title: "Discover jobs",
        whyNowFacts: ["No active opportunities are stored yet."],
        estimatedMinutes: 15,
        deepLink: "/workspace/jobs/discover",
        category: "setup",
      }),
    );
  }

  if (!latestInsight) {
    collected.push(
      candidate({
        type: "EVIDENCE_BUILDING",
        sourceEntityType: "CAREER_CONTEXT",
        sourceEntityId: null,
        intent: "career-evidence",
        title: "Add career evidence",
        whyNowFacts: ["Career evidence and skill context have not been generated yet."],
        estimatedMinutes: 15,
        deepLink: "/workspace/skills",
        category: "setup",
      }),
    );
  }

  void resumeVersions;

  const weeklyHandoff = await loadAdoptedWeeklyHandoffCandidates({
    userId: input.userId,
    timezone: input.preferences.timezone,
    now,
  });
  for (const item of weeklyHandoff) {
    const type = (
      [
        "JOB_APPLY",
        "JOB_PREPARE",
        "APPLICATION_FOLLOW_UP",
        "LINKEDIN_PUBLISH",
        "EVIDENCE_BUILDING",
        "SKILL_DEVELOPMENT",
        "WEEKLY_PREP",
        "CUSTOM_CAREER_ACTION",
      ] as DailyRoadmapActionType[]
    ).includes(item.type as DailyRoadmapActionType)
      ? (item.type as DailyRoadmapActionType)
      : "CUSTOM_CAREER_ACTION";
    collected.push(
      candidate({
        type,
        origin: "SYSTEM_RECOMMENDED",
        sourceEntityType: item.sourceEntityType,
        sourceEntityId: item.sourceEntityId,
        intent: item.intent,
        title: item.title,
        whyNowFacts: item.whyNowFacts,
        estimatedMinutes: item.estimatedMinutes,
        deepLink: item.deepLink,
        category: item.category,
        neglectSignals: ["weekly review focus"],
      }),
    );
  }

  const deduped = new Map<string, DailyActionCandidate>();
  for (const item of collected) {
    if (!item.deepLink) continue;
    const existing = deduped.get(item.fingerprint);
    if (!existing) {
      deduped.set(item.fingerprint, item);
      continue;
    }
    if (item.type === "JOB_APPLY" && existing.type !== "JOB_APPLY") {
      deduped.set(item.fingerprint, item);
    }
  }

  const rankedTypes: DailyRoadmapActionType[] = ["JOB_APPLY", "JOB_PREPARE", "JOB_REVIEW"];
  const byEntity = new Map<string, DailyActionCandidate[]>();
  for (const item of deduped.values()) {
    const key = `${item.sourceEntityType}:${item.sourceEntityId ?? item.fingerprint}`;
    const list = byEntity.get(key) ?? [];
    list.push(item);
    byEntity.set(key, list);
  }
  const collapsed: DailyActionCandidate[] = [];
  for (const group of byEntity.values()) {
    const jobGroup = group.filter((item) => rankedTypes.includes(item.type));
    if (jobGroup.length > 1) {
      jobGroup.sort((a, b) => rankedTypes.indexOf(a.type) - rankedTypes.indexOf(b.type));
      collapsed.push(jobGroup[0]);
      collapsed.push(...group.filter((item) => !rankedTypes.includes(item.type)));
    } else {
      collapsed.push(...group);
    }
  }

  return collapsed.slice(0, MAX_RAW_CANDIDATES).map((item) => ({
    ...item,
    estimatedMinutes: [5, 10, 15, 30, 45, 60, 90].includes(item.estimatedMinutes)
      ? item.estimatedMinutes
      : 15,
  }));
}

export function firstUseSuggestionsFromCandidates(candidates: DailyActionCandidate[]) {
  return candidates
    .filter((item) => item.category === "setup" && item.deepLink)
    .map((item) => ({
      title: item.title,
      whyNow: item.whyNowFacts[0] ?? "",
      deepLink: item.deepLink as string,
      label: item.title,
    }));
}
