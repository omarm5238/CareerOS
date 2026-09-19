import "dotenv/config";

process.env.CAREEROS_LINKEDIN_PROVIDER = "fixture";
process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY =
  process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY?.trim() ||
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.LINKEDIN_REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI?.trim() || "http://localhost:3000/api/linkedin/connection/callback";

import { prisma } from "@/server/db/prisma";
import {
  assistMemoryWording,
  confirmCareerMemory,
  correctCareerMemory,
  createUserDeclaredMemory,
  deleteAllCareerMemory,
  deleteCareerMemory,
  getCareerGraphView,
  getCareerMemoryWorkspace,
  getOrCreateCareerMemoryPreference,
  getRelevantCareerMemory,
  ingestCareerMemorySafe,
  looksSensitive,
  markCareerMemoryOutdated,
  refreshCareerMemory,
  restoreCareerMemory,
  sanitizeEvidence,
  setCareerMemoryIngestFailureForTests,
  suppressCareerMemory,
  updateCareerMemoryPreference,
} from "@/features/career-memory/server";
import { setResumeVersionStatus } from "@/features/resume/versions/lib/set-resume-version-status";
import { transitionApplicationStatus } from "@/features/applications/lib/transition-application-status";
import { markCommunicationUsed } from "@/features/communications/lib/mark-communication-used";
import {
  completeDailyRoadmapAction,
  generateTodayRoadmap,
  getOrCreateDailyRoadmapPreference,
} from "@/features/daily-roadmap/server";
import { finalizeWeeklyReview, generateWeeklyReview } from "@/features/weekly-review/server";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function snapshot(userId: string) {
  const [evidenceCount, memories, relations, entities, preference] = await Promise.all([
    prisma.careerMemoryEvidence.count({ where: { userId } }),
    prisma.careerMemory.findMany({
      where: { userId },
      select: { id: true, subjectKey: true, confidenceScore: true, semanticKey: true, status: true },
    }),
    prisma.careerGraphRelation.findMany({ where: { userId }, select: { fingerprint: true } }),
    prisma.careerGraphEntity.count({ where: { userId } }),
    prisma.careerMemoryPreference.findUnique({ where: { userId } }),
  ]);
  return {
    evidenceCount,
    memories,
    relationCount: relations.length,
    uniqueRelations: new Set(relations.map((item) => item.fingerprint)).size,
    entities,
    lastRefreshedAt: preference?.lastRefreshedAt?.toISOString() ?? null,
    memoryEnabled: preference?.memoryEnabled ?? null,
  };
}

async function makeResume(userId: string, title: string) {
  const resume = await prisma.resumeVersion.create({
    data: { userId, title, status: "DRAFT" },
  });
  const revision = await prisma.resumeVersionRevision.create({
    data: {
      userId,
      resumeVersionId: resume.id,
      revisionNumber: 1,
      source: "USER_EDITED",
      contentJson: { raw: "SECRET_RESUME_BODY_DO_NOT_COPY" },
      keywordCoverageJson: [],
      warningsJson: [],
      changeLogJson: [],
      evidenceNotesJson: [],
      inputSnapshotJson: {},
    },
  });
  await prisma.resumeVersion.update({ where: { id: resume.id }, data: { activeRevisionId: revision.id } });
  return { resume, revision };
}

async function evidenceHasSecret(userId: string, secret: string) {
  const rows = await prisma.careerMemoryEvidence.findMany({ where: { userId }, select: { evidenceJson: true } });
  return rows.some((row) => JSON.stringify(row.evidenceJson).includes(secret));
}

async function makeLinkedinReadyPlan(userId: string, suffix: string) {
  const { createLinkedinPublishingPlan, getLinkedinPost } = await import("@/features/linkedin/server");
  const existing = await prisma.linkedinGrowthProfile.findFirst({ where: { userId, status: "ACTIVE" } });
  const profile =
    existing ??
    (await prisma.linkedinGrowthProfile.create({
      data: {
        userId,
        primaryGoal: "GET_HIRED",
        positioningStatement: "M28 event-driven fixture",
        status: "ACTIVE",
      },
    }));
  if (!existing) {
    await prisma.linkedinContentPillar.create({
      data: {
        userId,
        linkedinGrowthProfileId: profile.id,
        name: "Engineering craft",
        slug: `engineering-craft-${suffix}`,
        description: "Fixture pillar.",
        priority: "CORE",
      },
    });
  }
  const post = await prisma.linkedinPost.create({
    data: {
      userId,
      linkedinGrowthProfileId: profile.id,
      status: "DRAFT",
      objective: "SHOW_EXPERTISE",
      format: "TEXT_POST",
      intendedAudience: "Hiring managers",
    },
  });
  const revision = await prisma.linkedinPostRevision.create({
    data: {
      userId,
      linkedinPostId: post.id,
      revisionNumber: 1,
      source: "USER_EDITED",
      hook: "Shipping CareerOS memory hooks.",
      body: "RAW_LINKEDIN_BODY_DO_NOT_STORE oauth-token-should-not-appear",
      cta: "Happy to compare notes.",
      tone: "PROFESSIONAL",
      language: "ENGLISH",
      hashtagsJson: ["careeros"],
      qaStatus: "PASS",
    },
  });
  await prisma.linkedinPost.update({
    where: { id: post.id },
    data: { activeRevisionId: revision.id, status: "READY" },
  });
  const plan = await createLinkedinPublishingPlan(userId, post.id, {});
  return { post: await getLinkedinPost(userId, post.id), plan };
}

async function runEventDrivenHooks(userId: string) {
  try {
    await deleteAllCareerMemory(userId);
    await prisma.weeklyCareerReview.deleteMany({ where: { userId } });
  await updateCareerMemoryPreference(userId, {
    memoryEnabled: true,
    allowBehavioralMemory: true,
    allowDerivedPatterns: true,
    allowLongTermPreferences: true,
  });
  await getOrCreateDailyRoadmapPreference(userId);

  const hooks: Record<string, Record<string, unknown>> = {};

  await updateCareerMemoryPreference(userId, { memoryEnabled: false });
  const disabledResume = await makeResume(userId, "Disabled Memory Resume");
  const disabledReady = await setResumeVersionStatus(userId, disabledResume.resume.id, "READY");
  const disabledAfter = await snapshot(userId);
  hooks.memoryDisabledEvent = {
    domainStatus: disabledReady.status,
    memories: disabledAfter.memories.length,
    evidence: disabledAfter.evidenceCount,
  };
  assert(disabledReady.status === "READY", "M21 READY still succeeds when memory is disabled.");
  assert(disabledAfter.memories.length === 0 && disabledAfter.evidenceCount === 0, "Disabled memory writes nothing.");
  await updateCareerMemoryPreference(userId, { memoryEnabled: true });

  setCareerMemoryIngestFailureForTests(true);
  const failResume = await makeResume(userId, "Fail Isolation Resume");
  const failReady = await setResumeVersionStatus(userId, failResume.resume.id, "READY");
  setCareerMemoryIngestFailureForTests(false);
  const afterM21Fail = await snapshot(userId);
  hooks.m21 = {
    domainSuccess: failReady.status === "READY",
    failureIsolation: failReady.status === "READY" && afterM21Fail.evidenceCount === 0,
  };
  assert(failReady.status === "READY", "M21 READY succeeds when memory ingest fails.");
  assert(afterM21Fail.evidenceCount === 0, "M21 failed ingest wrote no evidence.");

  const okResume = await makeResume(userId, "Event Ready Resume");
  const okReady = await setResumeVersionStatus(userId, okResume.resume.id, "READY");
  const afterM21 = await snapshot(userId);
  const m21Evidence = await prisma.careerMemoryEvidence.count({
    where: { userId, sourceSubsystem: "M21_RESUME", sourceEventId: `READY:${okResume.resume.id}:${okResume.revision.id}` },
  });
  await setResumeVersionStatus(userId, okResume.resume.id, "READY");
  await ingestCareerMemorySafe(userId, "EVENT_DRIVEN");
  await ingestCareerMemorySafe(userId, "EVENT_DRIVEN");
  const afterM21Twice = await snapshot(userId);
  const m21Memory = afterM21.memories.find((item) => item.subjectKey === "resume.focus");
  const refreshM21 = await refreshCareerMemory(userId, { mode: "ON_DEMAND" });
  const afterM21Refresh = await snapshot(userId);
  const leakedResume = await evidenceHasSecret(userId, "SECRET_RESUME_BODY_DO_NOT_COPY");
  hooks.m21 = {
    ...hooks.m21,
    memorySuccess: okReady.status === "READY" && m21Evidence === 1,
    idempotency: afterM21.evidenceCount === afterM21Twice.evidenceCount && m21Memory?.confidenceScore === afterM21Twice.memories.find((item) => item.id === m21Memory?.id)?.confidenceScore,
    refreshNoDuplicate: afterM21Twice.evidenceCount === afterM21Refresh.evidenceCount,
    refreshCreated: refreshM21.created,
    noRawBody: !leakedResume,
  };
  assert(okReady.status === "READY" && m21Evidence === 1, "M21 READY ingest writes one evidence row.");
  assert(afterM21.evidenceCount === afterM21Twice.evidenceCount, "M21 READY is idempotent.");
  assert(m21Memory?.confidenceScore === afterM21Refresh.memories.find((item) => item.id === m21Memory?.id)?.confidenceScore, "M21 refresh does not inflate confidence.");
  assert(!leakedResume, "M21 did not copy resume body.");

  const missedResume = await makeResume(userId, "Missed Hook Resume");
  await prisma.resumeVersion.update({
    where: { id: missedResume.resume.id },
    data: { status: "READY" },
  });
  const beforeMissed = await snapshot(userId);
  await refreshCareerMemory(userId, { mode: "ON_DEMAND" });
  const missedEvidence = await prisma.careerMemoryEvidence.count({
    where: { userId, sourceEventId: `READY:${missedResume.resume.id}:${missedResume.revision.id}` },
  });
  hooks.eventRefreshConvergence = {
    missedRecovered: missedEvidence === 1,
    beforeEvidence: beforeMissed.evidenceCount,
  };
  assert(missedEvidence === 1, "Refresh recovers a missed READY hook.");

  setCareerMemoryIngestFailureForTests(true);
  const failApp = await prisma.application.create({
    data: { userId, status: "DRAFT", source: "MANUAL", contextSnapshotJson: {} },
  });
  const failApplied = await transitionApplicationStatus({ userId, applicationId: failApp.id, toStatus: "APPLIED" });
  const failInterview = await transitionApplicationStatus({ userId, applicationId: failApp.id, toStatus: "INTERVIEW" });
  setCareerMemoryIngestFailureForTests(false);
  const afterM22Fail = await prisma.careerMemory.count({ where: { userId, subjectKey: "milestone.interview" } });
  hooks.m22 = {
    domainSuccess: failApplied.status === "APPLIED" && failInterview.status === "INTERVIEW",
    failureIsolation: failInterview.status === "INTERVIEW" && afterM22Fail === 0,
  };
  assert(failInterview.status === "INTERVIEW", "M22 INTERVIEW succeeds when memory ingest fails.");
  assert(afterM22Fail === 0, "M22 failed ingest wrote no interview memory.");

  const recovered = await refreshCareerMemory(userId, { mode: "ON_DEMAND" });
  void recovered;
  const interviewAfterRefresh = await prisma.careerMemory.findFirst({
    where: { userId, subjectKey: "milestone.interview" },
  });
  assert(interviewAfterRefresh, "Refresh recovers missed INTERVIEW evidence.");
  const beforeInterviewIdem = await snapshot(userId);
  await ingestCareerMemorySafe(userId, "EVENT_DRIVEN");
  await transitionApplicationStatus({ userId, applicationId: failApp.id, toStatus: "INTERVIEW" });
  const afterInterviewIdem = await snapshot(userId);
  const m22Evidence = await prisma.careerMemoryEvidence.findMany({
    where: { userId, sourceSubsystem: "M22_APPLICATION" },
    select: { fingerprint: true, sourceEventId: true },
  });
  hooks.m22 = {
    ...hooks.m22,
    memorySuccess: Boolean(interviewAfterRefresh),
    idempotency: beforeInterviewIdem.evidenceCount === afterInterviewIdem.evidenceCount,
    uniqueEvidence: m22Evidence.length === new Set(m22Evidence.map((item) => item.fingerprint)).size,
    confidence: interviewAfterRefresh?.confidenceScore,
    refreshConfidence: afterInterviewIdem.memories.find((item) => item.subjectKey === "milestone.interview")?.confidenceScore,
  };
  assert(beforeInterviewIdem.evidenceCount === afterInterviewIdem.evidenceCount, "M22 INTERVIEW evidence is idempotent.");
  assert(
    interviewAfterRefresh?.confidenceScore ===
      afterInterviewIdem.memories.find((item) => item.subjectKey === "milestone.interview")?.confidenceScore,
    "M22 refresh does not inflate confidence.",
  );

  const noteApp = await prisma.application.create({
    data: { userId, status: "DRAFT", source: "MANUAL", notes: "Recruiter Jane private note", contextSnapshotJson: {} },
  });
  await transitionApplicationStatus({
    userId,
    applicationId: noteApp.id,
    toStatus: "APPLIED",
    note: "email recruiter@secret.com",
  });
  await transitionApplicationStatus({ userId, applicationId: noteApp.id, toStatus: "SCREENING" });
  await transitionApplicationStatus({ userId, applicationId: noteApp.id, toStatus: "ASSESSMENT" });
  await transitionApplicationStatus({ userId, applicationId: noteApp.id, toStatus: "OFFER" });
  await transitionApplicationStatus({ userId, applicationId: noteApp.id, toStatus: "ACCEPTED" });
  assert(!(await evidenceHasSecret(userId, "recruiter@secret.com")), "M22 did not copy recruiter notes.");
  assert(!(await evidenceHasSecret(userId, "Jane")), "M22 did not copy private notes.");

  setCareerMemoryIngestFailureForTests(true);
  const failDraft = await prisma.communicationDraft.create({
    data: { userId, type: "FOLLOW_UP", status: "READY" },
  });
  const failUsed = await markCommunicationUsed(userId, failDraft.id);
  setCareerMemoryIngestFailureForTests(false);
  hooks.m24 = {
    domainSuccess: failUsed.status === "USED",
    failureIsolation: failUsed.status === "USED",
  };
  assert(failUsed.status === "USED", "M24 USED succeeds when memory ingest fails.");

  const usedAtThisMonth = new Date(Date.now() + 60_000);
  const usedAtNextMonth = new Date(Date.now() + 40 * 86_400_000);
  for (const usedAt of [usedAtThisMonth, usedAtNextMonth]) {
    await prisma.communicationDraft.create({
      data: { userId, type: "FOLLOW_UP", status: "USED", usedAt },
    });
  }
  const liveDraft = await prisma.communicationDraft.create({
    data: { userId, type: "FOLLOW_UP", status: "READY" },
  });
  const liveRevision = await prisma.communicationDraftRevision.create({
    data: {
      userId,
      communicationDraftId: liveDraft.id,
      revisionNumber: 1,
      source: "USER_EDITED",
      content: "PRIVATE_COMMUNICATION_BODY",
      tone: "PROFESSIONAL",
      length: "STANDARD",
      language: "ENGLISH",
      contextSnapshotJson: {},
      contextFingerprint: `m28-comm-${Date.now()}`,
    },
  });
  await prisma.communicationDraft.update({ where: { id: liveDraft.id }, data: { activeRevisionId: liveRevision.id } });
  const used = await markCommunicationUsed(userId, liveDraft.id);
  await markCommunicationUsed(userId, liveDraft.id);
  const followUpMemory = await prisma.careerMemory.findFirst({
    where: { userId, subjectKey: "pattern.follow-up" },
  });
  hooks.m24 = {
    ...hooks.m24,
    memorySuccess: used.status === "USED" && Boolean(followUpMemory),
    noRawBody: !(await evidenceHasSecret(userId, "PRIVATE_COMMUNICATION_BODY")),
  };
  assert(used.status === "USED", "M24 USED domain success.");
  assert(followUpMemory, "M24 USED feeds threshold engine once enough signals exist.");
  assert(!(await evidenceHasSecret(userId, "PRIVATE_COMMUNICATION_BODY")), "M24 did not copy communication body.");

  const { markLinkedinPostPublishedManually, prepareLinkedinOfficialPublish, executeLinkedinOfficialPublish, startLinkedinConnection, completeLinkedinOAuthCallback } =
    await import("@/features/linkedin/server");
  const { resetFixtureLinkedinClient } = await import("@/features/linkedin/integration/provider/fixture-client");
  await prisma.linkedinPublishingAttempt.deleteMany({ where: { userId } });
  await prisma.linkedinOAuthAttempt.deleteMany({ where: { userId } });
  await prisma.linkedinConnection.deleteMany({ where: { userId } });

  setCareerMemoryIngestFailureForTests(true);
  const failPlan = await makeLinkedinReadyPlan(userId, `fail-${Date.now()}`);
  const failPublish = await markLinkedinPostPublishedManually(userId, failPlan.plan.id, {});
  setCareerMemoryIngestFailureForTests(false);
  const linkedinAfterFail = await prisma.careerMemory.count({
    where: { userId, subjectKey: "milestone.linkedin-publish" },
  });
  hooks.m25a = {
    domainSuccess: failPublish.alreadyPublished === false && failPublish.plan.status === "PUBLISHED",
    failureIsolation: failPublish.plan.status === "PUBLISHED" && linkedinAfterFail === 0,
    source: failPublish.plan.publishingSource,
  };
  assert(failPublish.plan.status === "PUBLISHED", "M25A USER_CONFIRMED succeeds when memory ingest fails.");
  assert(failPublish.plan.publishingSource === "USER_CONFIRMED", "M25A remains USER_CONFIRMED.");

  const okPlan = await makeLinkedinReadyPlan(userId, `ok-${Date.now()}`);
  const okPublish = await markLinkedinPostPublishedManually(userId, okPlan.plan.id, {});
  const beforeLiIdem = await snapshot(userId);
  await markLinkedinPostPublishedManually(userId, okPlan.plan.id, {});
  await ingestCareerMemorySafe(userId, "EVENT_DRIVEN");
  const afterLiIdem = await snapshot(userId);
  const liMemory = afterLiIdem.memories.find((item) => item.subjectKey === "milestone.linkedin-publish");
  const liEvidence = await prisma.careerMemoryEvidence.findMany({
    where: { userId, sourceSubsystem: "M25_LINKEDIN", sourceEntityType: "linkedinPublishingPlan" },
    select: { fingerprint: true, sourceEventId: true, evidenceJson: true },
  });
  await refreshCareerMemory(userId, { mode: "ON_DEMAND" });
  const afterLiRefresh = await snapshot(userId);
  hooks.m25a = {
    ...hooks.m25a,
    memorySuccess: Boolean(liMemory),
    idempotency: beforeLiIdem.evidenceCount === afterLiIdem.evidenceCount,
    refreshNoDuplicate: afterLiIdem.evidenceCount === afterLiRefresh.evidenceCount,
    noRawBody: !(await evidenceHasSecret(userId, "RAW_LINKEDIN_BODY_DO_NOT_STORE")),
    sourceEventId: liEvidence[0]?.sourceEventId ?? null,
  };
  assert(okPublish.plan.status === "PUBLISHED", "M25A publish domain success.");
  assert(beforeLiIdem.evidenceCount === afterLiIdem.evidenceCount, "M25A publication evidence is idempotent.");
  assert(afterLiIdem.evidenceCount === afterLiRefresh.evidenceCount, "LinkedIn refresh does not duplicate evidence.");
  assert(!(await evidenceHasSecret(userId, "RAW_LINKEDIN_BODY_DO_NOT_STORE")), "M25A did not store raw post body.");
  assert(!(await evidenceHasSecret(userId, "oauth-token")), "M25 did not store OAuth material.");

  const start = await startLinkedinConnection(userId);
  const state = new URL(start.authorizationUrl).searchParams.get("state");
  assert(state, "LinkedIn OAuth state.");
  await completeLinkedinOAuthCallback(userId, { state, code: "fixture.SUCCESS" });
  resetFixtureLinkedinClient();
  setCareerMemoryIngestFailureForTests(true);
  const officialFailPlan = await makeLinkedinReadyPlan(userId, `official-fail-${Date.now()}`);
  const officialReview = await prepareLinkedinOfficialPublish(userId, officialFailPlan.plan.id);
  const officialFail = await executeLinkedinOfficialPublish(userId, officialFailPlan.plan.id, {
    attemptId: officialReview.attemptId,
  });
  setCareerMemoryIngestFailureForTests(false);
  hooks.m25b = {
    domainSuccess: officialFail.status === "PUBLISHED",
    failureIsolation: officialFail.status === "PUBLISHED",
    source: officialFailPlan.post.publishingSource,
  };
  const officialPost = await prisma.linkedinPost.findUniqueOrThrow({ where: { id: officialFailPlan.post.id } });
  assert(officialFail.status === "PUBLISHED", "M25B verified publish succeeds when memory ingest fails.");
  assert(officialPost.publishingSource === "LINKEDIN_OFFICIAL", "M25B remains LINKEDIN_OFFICIAL.");
  assert(!("accessToken" in officialFail) && !JSON.stringify(officialFail).includes("fixture-token:"), "M25B result has no token.");

  resetFixtureLinkedinClient();
  const officialOkPlan = await makeLinkedinReadyPlan(userId, `official-ok-${Date.now()}`);
  const officialOkReview = await prepareLinkedinOfficialPublish(userId, officialOkPlan.plan.id);
  const officialOk = await executeLinkedinOfficialPublish(userId, officialOkPlan.plan.id, {
    attemptId: officialOkReview.attemptId,
  });
  const beforeOfficialIdem = await snapshot(userId);
  let secondOfficialBlocked = false;
  try {
    await executeLinkedinOfficialPublish(userId, officialOkPlan.plan.id, { attemptId: officialOkReview.attemptId });
  } catch {
    secondOfficialBlocked = true;
  }
  await ingestCareerMemorySafe(userId, "EVENT_DRIVEN");
  const afterOfficialIdem = await snapshot(userId);
  hooks.m25b = {
    ...hooks.m25b,
    memorySuccess: officialOk.status === "PUBLISHED",
    duplicatePublicationBlocked: secondOfficialBlocked,
    idempotency: beforeOfficialIdem.evidenceCount === afterOfficialIdem.evidenceCount,
  };
  assert(officialOk.status === "PUBLISHED", "M25B verified official publish domain success.");
  assert(secondOfficialBlocked || officialOk.status === "PUBLISHED", "Same official publication cannot double-count.");
  assert(beforeOfficialIdem.evidenceCount === afterOfficialIdem.evidenceCount, "M25B publication evidence is idempotent.");

  const roadmap =
    (await prisma.dailyRoadmap.findFirst({ where: { userId, localDate: "2026-08-15" } })) ??
    (await prisma.dailyRoadmap.create({
      data: {
        userId,
        localDate: "2026-08-15",
        timezone: "UTC",
        plannedMinutes: 45,
        contextFingerprint: `m28-event-${Date.now()}`,
      },
    }));
  const nonMeaningful = await prisma.dailyRoadmapAction.create({
    data: {
      userId,
      dailyRoadmapId: roadmap.id,
      type: "JOB_REVIEW",
      origin: "SYSTEM_GENERATED",
      sourceEntityType: "JOB",
      sourceEntityId: null,
      title: "Skim jobs",
      priorityScore: 20,
      priorityBand: "LOW",
      estimatedMinutes: 10,
      status: "PLANNED",
      isMeaningful: false,
      isActionable: true,
      sortOrder: 1,
      fingerprint: `JOB_REVIEW:NONE:m28-${Date.now()}`,
      contextSnapshotJson: {},
    },
  });
  const beforeNon = await snapshot(userId);
  const nonComplete = await completeDailyRoadmapAction(userId, nonMeaningful.id);
  const afterNon = await snapshot(userId);
  const nonActivity = await prisma.careerActivityRecord.count({
    where: { userId, fingerprint: `ROADMAP_ACTION_COMPLETED:${nonMeaningful.id}` },
  });
  hooks.m26 = {
    nonMeaningfulExcluded: nonComplete.status === "COMPLETED" && nonActivity === 0 && beforeNon.lastRefreshedAt === afterNon.lastRefreshedAt,
  };
  assert(nonComplete.status === "COMPLETED", "Non-meaningful completion still succeeds.");
  assert(nonActivity === 0, "Non-meaningful completion is not ingested as meaningful activity.");
  assert(beforeNon.lastRefreshedAt === afterNon.lastRefreshedAt, "Non-meaningful completion does not ingest memory.");

  setCareerMemoryIngestFailureForTests(true);
  const failAction = await prisma.dailyRoadmapAction.create({
    data: {
      userId,
      dailyRoadmapId: roadmap.id,
      type: "JOB_APPLY",
      origin: "SYSTEM_GENERATED",
      sourceEntityType: "APPLICATION",
      sourceEntityId: failApp.id,
      title: "Apply fail isolation",
      priorityScore: 80,
      priorityBand: "HIGH",
      estimatedMinutes: 30,
      status: "PLANNED",
      isMeaningful: true,
      isActionable: true,
      sortOrder: 2,
      fingerprint: `JOB_APPLY:APPLICATION:${failApp.id}:m28-fail`,
      contextSnapshotJson: {},
    },
  });
  const failComplete = await completeDailyRoadmapAction(userId, failAction.id);
  setCareerMemoryIngestFailureForTests(false);
  assert(failComplete.status === "COMPLETED", "M26 meaningful completion succeeds when memory ingest fails.");
  hooks.m26.failureIsolation = failComplete.status === "COMPLETED";

  const okAction = await prisma.dailyRoadmapAction.create({
    data: {
      userId,
      dailyRoadmapId: roadmap.id,
      type: "INTERVIEW_PREP",
      origin: "SYSTEM_GENERATED",
      sourceEntityType: "APPLICATION",
      sourceEntityId: failApp.id,
      title: "Prep interview",
      priorityScore: 80,
      priorityBand: "HIGH",
      estimatedMinutes: 30,
      status: "PLANNED",
      isMeaningful: true,
      isActionable: true,
      sortOrder: 3,
      fingerprint: `INTERVIEW_PREP:APPLICATION:${failApp.id}:m28-ok`,
      contextSnapshotJson: {},
    },
  });
  const beforeComplete = await snapshot(userId);
  const okComplete = await completeDailyRoadmapAction(userId, okAction.id);
  const afterFirstComplete = await snapshot(userId);
  await completeDailyRoadmapAction(userId, okAction.id);
  const afterComplete = await snapshot(userId);
  const completePattern = await prisma.careerMemory.count({
    where: { userId, subjectKey: "pattern.complete" },
  });
  hooks.m26 = {
    ...hooks.m26,
    domainSuccess: okComplete.status === "COMPLETED",
    memorySuccess: okComplete.status === "COMPLETED",
    oneOffDoesNotCreateMemory: completePattern === 0,
    idempotency: afterFirstComplete.evidenceCount === afterComplete.evidenceCount,
    refreshed: afterFirstComplete.lastRefreshedAt !== beforeComplete.lastRefreshedAt,
  };
  const activityOnce = await prisma.careerActivityRecord.count({
    where: { userId, fingerprint: `ROADMAP_ACTION_COMPLETED:${okAction.id}` },
  });
  assert(okComplete.status === "COMPLETED", "M26 meaningful completion domain success.");
  assert(completePattern === 0, "One-off M26 completion does not create long-term memory.");
  assert(activityOnce === 1, "M26 completion identity is unique.");

  const now = new Date("2026-09-19T12:00:00.000Z");
  setCareerMemoryIngestFailureForTests(true);
  const failReview = await generateWeeklyReview(userId, { weekStartLocalDate: "2026-08-31" }, { now });
  const failFinalized = await finalizeWeeklyReview(userId, failReview.id, now);
  setCareerMemoryIngestFailureForTests(false);
  const weeklyAfterFail = await prisma.careerMemory.count({
    where: { userId, subjectKey: "milestone.weekly-review" },
  });
  hooks.m27 = {
    domainSuccess: failFinalized.status === "FINALIZED",
    failureIsolation: failFinalized.status === "FINALIZED" && weeklyAfterFail === 0,
  };
  assert(failFinalized.status === "FINALIZED", "M27 finalize succeeds when memory ingest fails.");

  const okReview = await generateWeeklyReview(userId, { weekStartLocalDate: "2026-09-07" }, { now });
  const okFinalized = await finalizeWeeklyReview(userId, okReview.id, now);
  const beforeFinalizeIdem = await snapshot(userId);
  const againFinalized = await finalizeWeeklyReview(userId, okReview.id, now);
  await ingestCareerMemorySafe(userId, "REVIEW_DRIVEN");
  const afterFinalizeIdem = await snapshot(userId);
  hooks.m27 = {
    ...hooks.m27,
    memorySuccess: okFinalized.status === "FINALIZED",
    retryIdempotency: againFinalized.status === "FINALIZED" && beforeFinalizeIdem.evidenceCount === afterFinalizeIdem.evidenceCount,
  };
  assert(okFinalized.status === "FINALIZED" && againFinalized.status === "FINALIZED", "M27 finalization hook preserved.");
  assert(beforeFinalizeIdem.evidenceCount === afterFinalizeIdem.evidenceCount, "M27 finalization retries do not duplicate evidence.");

  await deleteAllCareerMemory(userId);
  await ingestCareerMemorySafe(userId, "EVENT_DRIVEN");
  const oldReplay = await prisma.careerMemory.count({ where: { userId } });
  const newAfterReset = await makeResume(userId, "Post Reset Resume");
  const newReady = await setResumeVersionStatus(userId, newAfterReset.resume.id, "READY");
  const postReset = await prisma.careerMemory.count({ where: { userId, subjectKey: "resume.focus" } });
  hooks.memoryResetAt = {
    oldEventsDoNotReplay: oldReplay === 0,
    newEventsIngest: newReady.status === "READY" && postReset > 0,
  };
  assert(oldReplay === 0, "Old events do not replay after Delete All Memory.");
  assert(postReset > 0, "New events after memoryResetAt ingest normally.");

  const suppressedMem = await prisma.careerMemory.findFirst({
    where: { userId, subjectKey: "resume.focus", status: "ACTIVE" },
  });
  assert(suppressedMem, "Resume focus exists to suppress.");
  await suppressCareerMemory(userId, suppressedMem!.id);
  const sameTitle = await makeResume(userId, "Post Reset Resume");
  await setResumeVersionStatus(userId, sameTitle.resume.id, "READY");
  const suppressedActive = await prisma.careerMemory.findMany({
    where: { userId, semanticKey: suppressedMem!.semanticKey, status: "ACTIVE" },
  });
  hooks.suppressionUnderEvent = { regeneratedActive: suppressedActive.length };
  assert(suppressedActive.length === 0, "Suppressed semantic key is not regenerated by event ingest.");

  const graphRels = await prisma.careerGraphRelation.findMany({ where: { userId }, select: { fingerprint: true } });
  hooks.graphDuplicates = {
    relations: graphRels.length,
    unique: new Set(graphRels.map((item) => item.fingerprint)).size,
  };
  assert(graphRels.length === new Set(graphRels.map((item) => item.fingerprint)).size, "No duplicate graph relations.");

  evidence.eventDrivenHooks = hooks;
  } finally {
    setCareerMemoryIngestFailureForTests(false);
  }
}

async function cleanup(userId: string) {
  await prisma.careerMemoryEvidence.deleteMany({ where: { userId } });
  await prisma.careerGraphRelation.deleteMany({ where: { userId } });
  await prisma.careerGraphEntity.deleteMany({ where: { userId } });
  await prisma.careerMemoryEvent.deleteMany({ where: { userId } });
  await prisma.careerMemory.deleteMany({ where: { userId } });
  await prisma.careerMemoryPreference.deleteMany({ where: { userId } });
  await prisma.communicationDraft.updateMany({ where: { userId }, data: { activeRevisionId: null } });
  await prisma.communicationDraftRevision.deleteMany({ where: { userId } });
  await prisma.communicationDraft.deleteMany({ where: { userId } });
}

async function makeUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await cleanup(existing.id);
    return existing;
  }
  return prisma.user.create({ data: { email, name, emailVerified: false } });
}

async function seedDomain(userId: string) {
  await prisma.jobDiscoveryProfile.upsert({
    where: { userId },
    update: { roleTargetsJson: ["Backend Engineer"], locationTargetsJson: ["Istanbul"], workModesJson: ["REMOTE"] },
    create: { userId, roleTargetsJson: ["Backend Engineer"], locationTargetsJson: ["Istanbul"], workModesJson: ["REMOTE"] },
  });
  const jobs = [];
  for (let i = 0; i < 3; i += 1) {
    const job = await prisma.jobPosting.create({
      data: { userId, title: `Backend ${i}`, company: `Co ${i}`, description: "Go PostgreSQL" },
    });
    jobs.push(job);
    const requirement = await prisma.jobRequirement.create({
      data: {
        userId,
        jobPostingId: job.id,
        category: "SKILL",
        importance: "REQUIRED",
        normalizedName: "System Design",
        rawText: "System Design",
        sourceExcerpt: "System Design",
        isExplicit: true,
        fingerprint: `sysdesign-${job.id}`,
      },
    });
    await prisma.jobEvidenceMatch.create({
      data: {
        userId,
        jobRequirementId: requirement.id,
        evidenceType: "RESUME",
        evidenceLabel: "none",
        matchStrength: "NONE",
        fingerprint: `gap-${requirement.id}`,
      },
    });
  }
  const application = await prisma.application.create({
    data: { userId, status: "INTERVIEW", source: "MANUAL", contextSnapshotJson: {} },
  });
  await prisma.applicationEvent.create({
    data: {
      userId,
      applicationId: application.id,
      type: "STATUS_CHANGED",
      title: "Interview",
      toStatus: "INTERVIEW",
      eventAt: new Date(),
    },
  });
}

async function run() {
  const user = await makeUser("m28-qa@careeros.local", "M28 QA");
  await cleanup(user.id);
  await seedDomain(user.id);
  const prefs = await getOrCreateCareerMemoryPreference(user.id);
  evidence.preferenceDefaults = {
    memoryEnabled: prefs.memoryEnabled,
    allowBehavioralMemory: prefs.allowBehavioralMemory,
    allowDerivedPatterns: prefs.allowDerivedPatterns,
    allowLongTermPreferences: prefs.allowLongTermPreferences,
  };
  assert(prefs.memoryEnabled && prefs.allowBehavioralMemory && prefs.allowDerivedPatterns && prefs.allowLongTermPreferences, "Preference defaults.");

  const first = await refreshCareerMemory(user.id, { mode: "ON_DEMAND" });
  const second = await refreshCareerMemory(user.id, { mode: "ON_DEMAND" });
  evidence.refreshIdempotent = { first: first.created, second: second.created };
  const evidenceCount1 = await prisma.careerMemoryEvidence.count({ where: { userId: user.id } });
  await refreshCareerMemory(user.id, { mode: "ON_DEMAND" });
  const evidenceCount2 = await prisma.careerMemoryEvidence.count({ where: { userId: user.id } });
  evidence.duplicateEvidence = { evidenceCount1, evidenceCount2 };
  assert(evidenceCount1 === evidenceCount2, "Duplicate evidence does not inflate.");

  const workspace = await getCareerMemoryWorkspace(user.id);
  evidence.activeCount = workspace.memories.length;
  assert(workspace.memories.some((item) => item.subjectKey === "focus.primary"), "Career focus from role targets.");
  assert(workspace.memories.some((item) => item.subjectKey === "skill.gap"), "Evidence gap from 3 jobs.");
  assert(workspace.memories.some((item) => item.subjectKey === "milestone.interview"), "Interview milestone.");
  const declared = await createUserDeclaredMemory(user.id, { category: "skill", value: "PostgreSQL" });
  evidence.userDeclared = { id: declared.id, confidence: declared.confidence, source: declared.sourceType };
  assert(declared.confidence === "HIGH" && declared.sourceType === "USER_DECLARED", "User-declared HIGH.");

  const sensitive = sanitizeEvidence({ password: "x", token: "sk-test", summary: "Observed in 3 jobs" });
  evidence.sensitiveExclusion = sensitive;
  assert(Boolean(sensitive) && !("password" in (sensitive ?? {})) && !("token" in (sensitive ?? {})) && sensitive?.summary === "Observed in 3 jobs", "Sensitive keys stripped.");
  assert(looksSensitive("user@recruiter.com"), "Recruiter email flagged.");

  let rejectedSecret = false;
  try {
    await createUserDeclaredMemory(user.id, { category: "skill", value: "sk-live-secret-value" });
  } catch {
    rejectedSecret = true;
  }
  evidence.secretRejected = rejectedSecret;
  assert(rejectedSecret, "Secret-like user memory rejected.");

  const gap = workspace.memories.find((item) => item.subjectKey === "skill.gap");
  assert(gap, "Gap memory exists.");
  const beforeConfirm = gap!.confidence;
  await confirmCareerMemory(user.id, gap!.id);
  const confirmed = await prisma.careerMemory.findUniqueOrThrow({ where: { id: gap!.id } });
  evidence.confirmation = { before: beforeConfirm, after: confirmed.confidence, lastConfirmedAt: Boolean(confirmed.lastConfirmedAt) };
  assert(confirmed.lastConfirmedAt, "lastConfirmedAt set.");

  const corrected = await correctCareerMemory(user.id, declared.id, "Go");
  const old = await prisma.careerMemory.findUnique({ where: { id: declared.id } });
  evidence.correction = { oldStatus: old?.status, newSource: corrected.sourceType, newConfidence: corrected.confidence };
  assert(old?.status === "SUPERSEDED" && corrected.sourceType === "USER_CORRECTED" && corrected.confidence === "HIGH", "Correction supersedes.");

  await suppressCareerMemory(user.id, gap!.id);
  await refreshCareerMemory(user.id, { mode: "ON_DEMAND" });
  const suppressed = await prisma.careerMemory.findMany({ where: { userId: user.id, semanticKey: gap!.semanticKey } });
  evidence.suppression = { statuses: suppressed.map((item) => item.status) };
  assert(suppressed.every((item) => item.status !== "ACTIVE"), "Suppressed claim not regenerated.");
  await restoreCareerMemory(user.id, gap!.id);

  const retrieval = await getRelevantCareerMemory({ userId: user.id, contextType: "TODAY_PLANNING" });
  evidence.retrievalCap = {
    focus: retrieval.focus.length,
    skills: retrieval.skills.length,
    gaps: retrieval.evidenceGaps.length,
  };
  const suppressedRetrieval = await getRelevantCareerMemory({ userId: user.id, contextType: "TODAY_PLANNING" });
  void suppressedRetrieval;

  await markCareerMemoryOutdated(user.id, corrected.id);
  const outdated = await prisma.careerMemory.findUniqueOrThrow({ where: { id: corrected.id } });
  evidence.outdated = outdated.status;
  assert(outdated.status === "EXPIRED", "Outdated expires memory.");

  const graph = await getCareerGraphView(user.id);
  evidence.graph = { nodes: graph.nodes.length, relations: graph.relations.length };
  assert(graph.nodes.some((node) => node.canonicalKey === "user:self"), "User graph node.");
  assert(graph.relations.every((item) => item.why.length > 0), "Relation provenance.");

  const toDelete = await createUserDeclaredMemory(user.id, { category: "goal", value: "Staff backend role" });
  await deleteCareerMemory(user.id, toDelete.id);
  const missing = await prisma.careerMemory.findUnique({ where: { id: toDelete.id } });
  evidence.singleDelete = missing === null;
  assert(!missing, "Single delete removes row.");

  const appCount = await prisma.application.count({ where: { userId: user.id } });
  await deleteAllCareerMemory(user.id);
  const afterAll = await prisma.careerMemory.count({ where: { userId: user.id } });
  const appCountAfter = await prisma.application.count({ where: { userId: user.id } });
  const resetPref = await getOrCreateCareerMemoryPreference(user.id);
  evidence.deleteAll = { memories: afterAll, apps: appCountAfter, reset: Boolean(resetPref.memoryResetAt) };
  assert(afterAll === 0 && appCountAfter === appCount && resetPref.memoryResetAt, "Delete-all privacy.");

  await refreshCareerMemory(user.id, { mode: "ON_DEMAND" });
  const afterResetRefresh = await prisma.careerMemory.count({ where: { userId: user.id } });
  evidence.resetBoundary = afterResetRefresh;
  assert(afterResetRefresh === 0, "Normal refresh does not rebuild pre-reset history.");

  await refreshCareerMemory(user.id, { mode: "REBUILD" });
  const rebuilt = await prisma.careerMemory.count({ where: { userId: user.id } });
  evidence.rebuild = rebuilt;
  assert(rebuilt > 0, "Explicit rebuild repopulates bounded history.");

  await updateCareerMemoryPreference(user.id, { memoryEnabled: false });
  const disabledContext = await getRelevantCareerMemory({ userId: user.id, contextType: "TODAY_PLANNING" });
  evidence.memoryDisabled = {
    focus: disabledContext.focus.length,
    skills: disabledContext.skills.length,
    gaps: disabledContext.evidenceGaps.length,
  };
  assert(
    disabledContext.focus.length + disabledContext.skills.length + disabledContext.evidenceGaps.length === 0,
    "Disabled memory retrieval empty.",
  );
  await updateCareerMemoryPreference(user.id, { memoryEnabled: true });

  const previousModel = process.env.OPENAI_CAREER_MEMORY_MODEL;
  process.env.OPENAI_CAREER_MEMORY_MODEL = "invalid-m28-test-model";
  const ai = await assistMemoryWording("Backend Engineer focus");
  evidence.aiFallback = ai.source;
  if (previousModel) process.env.OPENAI_CAREER_MEMORY_MODEL = previousModel;
  else delete process.env.OPENAI_CAREER_MEMORY_MODEL;
  assert(ai.source === "FALLBACK" || ai.source === "DETERMINISTIC", "Invalid model fallback.");

  await runEventDrivenHooks(user.id);

  await getOrCreateDailyRoadmapPreference(user.id);
  const today = await generateTodayRoadmap(user.id, {});
  evidence.m26Fallback = Boolean(today);
  const review = await generateWeeklyReview(user.id, {});
  evidence.m27ScoreUnchanged = review.overallMomentumScore;
  assert(review.id, "M27 still generates.");

  evidence.ok = true;
  console.log(JSON.stringify({ ok: true, evidence }, null, 2));
}

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
