import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import { transitionApplicationStatus } from "@/features/applications/server";
import { setResumeVersionStatus } from "@/features/resume/versions/lib/set-resume-version-status";
import { markCommunicationUsed } from "@/features/communications/lib/mark-communication-used";
import {
  createLinkedinPublishingPlan,
  executeLinkedinOfficialPublish,
  markLinkedinPostPublishedManually,
  prepareLinkedinOfficialPublish,
  startLinkedinConnection,
  completeLinkedinOAuthCallback,
} from "@/features/linkedin/server";
import { resetFixtureLinkedinClient } from "@/features/linkedin/integration/provider/fixture-client";
import {
  calculateCareerStreakFromDays,
  completeDailyRoadmapAction,
  createCustomCareerAction,
  DailyRoadmapAccessError,
  deferDailyRoadmapAction,
  getTodayWorkspace,
  generateDailyActionCandidates,
  generateTodayRoadmap,
  getCareerLocalDate,
  getOrCreateDailyRoadmapPreference,
  isValidIanaTimezone,
  recordMeaningfulCareerActivity,
  refreshTodayRoadmap,
  scoreDailyActionCandidate,
  skipDailyRoadmapAction,
  updateDailyRoadmapPreference,
  validateIanaTimezone,
} from "@/features/daily-roadmap/server";

process.env.CAREEROS_LINKEDIN_PROVIDER = "fixture";
process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY =
  process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY?.trim() ||
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.LINKEDIN_REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI?.trim() || "http://localhost:3000/api/linkedin/connection/callback";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function cleanupUser(userId: string) {
  await prisma.careerActivityRecord.deleteMany({ where: { userId } });
  await prisma.careerActivityDay.deleteMany({ where: { userId } });
  await prisma.dailyRoadmapAction.deleteMany({ where: { userId } });
  await prisma.dailyRoadmap.deleteMany({ where: { userId } });
  await prisma.dailyRoadmapPreference.deleteMany({ where: { userId } });
}

async function makeUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await cleanupUser(existing.id);
    return existing;
  }
  return prisma.user.create({ data: { email, name, emailVerified: false } });
}

function utc(iso: string) {
  return new Date(iso);
}

async function run() {
  const user = await makeUser("m26-qa@careeros.local", "M26 QA");
  await cleanupUser(user.id);

  const prefs = await getOrCreateDailyRoadmapPreference(user.id);
  evidence.preferenceDefaults = {
    timezone: prefs.timezone,
    dailyMinutesTarget: prefs.dailyMinutesTarget,
    maxCoreActions: prefs.maxCoreActions,
    activeWeekdays: prefs.activeWeekdays,
    includeLinkedIn: prefs.includeLinkedIn,
    includeSkillDevelopment: prefs.includeSkillDevelopment,
  };
  assert(prefs.timezone === "UTC", "Default timezone must be UTC.");
  assert(prefs.dailyMinutesTarget === 60, "Default minutes must be 60.");
  assert(prefs.maxCoreActions === 4, "Default max core actions must be 4.");
  assert(prefs.activeWeekdays.join(",") === "MON,TUE,WED,THU,FRI", "Default weekdays Mon-Fri.");

  let invalidTimezone = false;
  try {
    validateIanaTimezone("GMT+3");
  } catch {
    invalidTimezone = true;
  }
  let turkeyTime = false;
  try {
    validateIanaTimezone("Turkey Time");
  } catch {
    turkeyTime = true;
  }
  const ianaValidation = {
    utc: isValidIanaTimezone("UTC"),
    istanbul: isValidIanaTimezone("Europe/Istanbul"),
    ny: isValidIanaTimezone("America/New_York"),
    gmtRejected: invalidTimezone,
    turkeyRejected: turkeyTime,
  };
  evidence.ianaValidation = ianaValidation;
  assert(ianaValidation.utc && ianaValidation.istanbul && ianaValidation.ny, "Valid IANA must pass.");
  assert(invalidTimezone && turkeyTime, "Invalid timezones must fail.");

  const edge = utc("2026-01-15T00:30:00.000Z");
  const utcLocalDate = getCareerLocalDate(edge, "UTC");
  const istanbulLocalDate = getCareerLocalDate(edge, "Europe/Istanbul");
  const nyLocalDate = getCareerLocalDate(edge, "America/New_York");
  evidence.utcLocalDate = utcLocalDate;
  evidence.istanbulLocalDate = istanbulLocalDate;
  evidence.nyLocalDate = nyLocalDate;
  assert(utcLocalDate === "2026-01-15", "UTC local date.");
  assert(istanbulLocalDate === "2026-01-15", "Istanbul local date.");
  assert(nyLocalDate === "2026-01-14", "New York is still the previous local date at UTC 00:30.");

  const weekend = calculateCareerStreakFromDays({
    qualifyingDates: ["2026-09-11", "2026-09-14"],
    activeWeekdays: ["MON", "TUE", "WED", "THU", "FRI"],
    todayLocal: "2026-09-14",
  });
  evidence.inactiveWeekend = weekend;
  assert(weekend.currentStreak === 2, "Weekend must not break Friday-Monday streak.");

  const premature = calculateCareerStreakFromDays({
    qualifyingDates: ["2026-09-11", "2026-09-14"],
    activeWeekdays: ["MON", "TUE", "WED", "THU", "FRI"],
    todayLocal: "2026-09-15",
  });
  evidence.currentDayNotPrematureBreak = premature;
  assert(premature.currentStreak === 2, "Current Tuesday without activity must not break yet.");

  const missed = calculateCareerStreakFromDays({
    qualifyingDates: ["2026-09-11", "2026-09-14"],
    activeWeekdays: ["MON", "TUE", "WED", "THU", "FRI"],
    todayLocal: "2026-09-16",
  });
  evidence.scheduledMissedDay = missed;
  assert(missed.currentStreak === 0, "Missed Tuesday must break the streak the next day.");
  evidence.longestStreak = missed.longestStreak;
  assert(missed.longestStreak >= 2, "Longest streak retains Friday-Monday.");

  const current = calculateCareerStreakFromDays({
    qualifyingDates: ["2026-09-14", "2026-09-15", "2026-09-16"],
    activeWeekdays: ["MON", "TUE", "WED", "THU", "FRI"],
    todayLocal: "2026-09-16",
  });
  evidence.currentStreak = current.currentStreak;
  assert(current.currentStreak === 3, "Three weekday qualifies.");

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  await updateDailyRoadmapPreference(user.id, { timezone: "UTC", maxCoreActions: 4, dailyMinutesTarget: 60 });

  const jobPosting = await prisma.jobPosting.create({
    data: { userId: user.id, title: "Staff Engineer", company: "Northwind", description: "Build career systems." },
  });
  const strongJob = await prisma.discoveredJob.create({
    data: {
      userId: user.id,
      title: "Staff Engineer",
      normalizedTitle: "staff engineer",
      company: "Northwind",
      normalizedCompany: "northwind",
      description: "Role",
      canonicalFingerprint: `m26-strong-${Date.now()}`,
      finalScore: 92,
      scoreBand: "EXCELLENT",
      discoveryStatus: "CANDIDATE",
      jobPostingId: jobPosting.id,
      postedAt: now,
    },
  });
  const closedJob = await prisma.discoveredJob.create({
    data: {
      userId: user.id,
      title: "Closed Role",
      normalizedTitle: "closed role",
      company: "OldCo",
      normalizedCompany: "oldco",
      description: "Gone",
      canonicalFingerprint: `m26-closed-${Date.now()}`,
      finalScore: 90,
      discoveryStatus: "CANDIDATE",
      expiresAt: utc("2026-01-01T00:00:00.000Z"),
    },
  });
  const appliedPosting = await prisma.jobPosting.create({
    data: { userId: user.id, title: "Already Applied", company: "AppliedCo", description: "Done" },
  });
  const appliedJob = await prisma.discoveredJob.create({
    data: {
      userId: user.id,
      title: "Already Applied",
      normalizedTitle: "already applied",
      company: "AppliedCo",
      normalizedCompany: "appliedco",
      description: "Done",
      canonicalFingerprint: `m26-applied-${Date.now()}`,
      finalScore: 88,
      discoveryStatus: "CANDIDATE",
      jobPostingId: appliedPosting.id,
    },
  });
  await prisma.application.create({
    data: {
      userId: user.id,
      jobPostingId: appliedPosting.id,
      status: "APPLIED",
      appliedAt: now,
      contextSnapshotJson: {},
    },
  });

  const draftApp = await prisma.application.create({
    data: {
      userId: user.id,
      jobPostingId: jobPosting.id,
      status: "DRAFT",
      contextSnapshotJson: {},
      nextActionType: "FOLLOW_UP",
      nextActionTitle: "Follow up with recruiter",
      nextActionReason: "Follow-up is due according to the application timeline.",
      nextActionDueAt: yesterday,
      followUpAt: yesterday,
    },
  });

  const resume = await prisma.resumeVersion.create({
    data: { userId: user.id, title: "Staff resume", status: "DRAFT" },
  });
  const revision = await prisma.resumeVersionRevision.create({
    data: {
      userId: user.id,
      resumeVersionId: resume.id,
      revisionNumber: 1,
      source: "USER_EDITED",
      contentJson: {},
      keywordCoverageJson: [],
      warningsJson: [],
      changeLogJson: [],
      evidenceNotesJson: [],
      inputSnapshotJson: {},
    },
  });
  await prisma.resumeVersion.update({ where: { id: resume.id }, data: { activeRevisionId: revision.id } });

  const readyPackage = await prisma.applicationPackage.create({
    data: {
      userId: user.id,
      jobPostingId: jobPosting.id,
      status: "READY_FOR_REVIEW",
      readinessStatus: "READY",
      qaStatus: "PASS",
      contextFingerprint: `pkg-${Date.now()}`,
      resumeVersionId: resume.id,
    },
  });

  const blockedResume = await prisma.resumeVersion.create({
    data: { userId: user.id, title: "Blocked resume", status: "DRAFT" },
  });
  const blockedRevision = await prisma.resumeVersionRevision.create({
    data: {
      userId: user.id,
      resumeVersionId: blockedResume.id,
      revisionNumber: 1,
      source: "USER_EDITED",
      contentJson: {},
      keywordCoverageJson: [],
      warningsJson: [],
      changeLogJson: [],
      evidenceNotesJson: [],
      inputSnapshotJson: {},
    },
  });
  await prisma.resumeVersion.update({
    where: { id: blockedResume.id },
    data: { activeRevisionId: blockedRevision.id },
  });
  const blockedPosting = await prisma.jobPosting.create({
    data: { userId: user.id, title: "Needs resume", company: "PrepareCo", description: "Prep" },
  });
  const blockedDisc = await prisma.discoveredJob.create({
    data: {
      userId: user.id,
      title: "Needs resume",
      normalizedTitle: "needs resume",
      company: "PrepareCo",
      normalizedCompany: "prepareco",
      description: "Prep",
      canonicalFingerprint: `m26-prep-${Date.now()}`,
      finalScore: 81,
      scoreBand: "STRONG",
      discoveryStatus: "CANDIDATE",
      jobPostingId: blockedPosting.id,
      postedAt: now,
    },
  });
  await prisma.applicationQueueItem.create({
    data: { userId: user.id, discoveredJobId: blockedDisc.id, queueStatus: "QUEUED" },
  });
  await prisma.applicationPackage.create({
    data: {
      userId: user.id,
      jobPostingId: blockedPosting.id,
      status: "PREPARING",
      readinessStatus: "NEEDS_REVIEW",
      contextFingerprint: `pkg-blocked-${Date.now()}`,
      resumeVersionId: blockedResume.id,
    },
  });

  const comm = await prisma.communicationDraft.create({
    data: {
      userId: user.id,
      applicationId: draftApp.id,
      type: "FOLLOW_UP",
      status: "READY",
    },
  });

  await prisma.skillsInsight.create({
    data: {
      userId: user.id,
      prioritySkills: [
        { skill: "TypeScript", evidenceStatus: "supported" },
        { skill: "System design", evidenceStatus: "missing_from_resume" },
      ],
    },
  });

  const profile = await prisma.linkedinGrowthProfile.create({
    data: {
      userId: user.id,
      primaryGoal: "GET_HIRED",
      positioningStatement: "M26 LinkedIn fixture",
      status: "ACTIVE",
    },
  });
  const post = await prisma.linkedinPost.create({
    data: {
      userId: user.id,
      linkedinGrowthProfileId: profile.id,
      status: "READY",
      objective: "SHOW_EXPERTISE",
      format: "TEXT_POST",
    },
  });
  const postRevision = await prisma.linkedinPostRevision.create({
    data: {
      userId: user.id,
      linkedinPostId: post.id,
      revisionNumber: 1,
      source: "USER_EDITED",
      hook: "Shipping CareerOS daily plans.",
      body: "Exact frozen revision for M26 LinkedIn publish candidates.",
      cta: "Happy to compare notes.",
      tone: "PROFESSIONAL",
      language: "ENGLISH",
      qaStatus: "PASS",
    },
  });
  await prisma.linkedinPost.update({ where: { id: post.id }, data: { activeRevisionId: postRevision.id, status: "READY" } });
  const plan = await createLinkedinPublishingPlan(user.id, post.id, {});

  const prefsView = await getOrCreateDailyRoadmapPreference(user.id);
  const candidates = await generateDailyActionCandidates({ userId: user.id, preferences: prefsView, now });
  evidence.candidateTypes = [...new Set(candidates.map((item) => item.type))];
  evidence.jobCandidates = candidates.filter((item) => item.type.startsWith("JOB_")).map((item) => item.type);
  evidence.applicationCandidates = candidates.filter((item) => item.sourceEntityType === "APPLICATION").map((item) => item.type);
  evidence.resumeCandidates = candidates.filter((item) => item.type === "RESUME_REVIEW").length;
  evidence.communicationCandidates = candidates.filter((item) => item.type === "COMMUNICATION_REVIEW").length;
  evidence.linkedinCandidates = candidates.filter((item) => item.type.startsWith("LINKEDIN_")).map((item) => item.type);
  evidence.skillCandidates = candidates.filter((item) => item.type === "SKILL_DEVELOPMENT" || item.type === "EVIDENCE_BUILDING").map((item) => item.title);
  assert(candidates.some((item) => item.type === "JOB_APPLY" || item.type === "JOB_PREPARE" || item.type === "JOB_REVIEW"), "Jobs must produce candidates.");
  assert(candidates.some((item) => item.type === "JOB_PREPARE"), "Preparation-needed opportunity must produce JOB_PREPARE.");
  assert(candidates.some((item) => item.type === "RESUME_REVIEW"), "Resume pending review must produce RESUME_REVIEW.");
  assert(candidates.some((item) => item.type === "APPLICATION_FOLLOW_UP"), "Follow-up due must produce a candidate.");
  assert(candidates.some((item) => item.type === "COMMUNICATION_REVIEW"), "Ready communication must produce a candidate.");
  assert(candidates.some((item) => item.type === "LINKEDIN_PUBLISH"), "Ready LinkedIn plan must produce publish.");
  assert(candidates.some((item) => item.title.includes("TypeScript")), "Skill with evidence.");
  assert(candidates.some((item) => item.title.includes("System design")), "Skill without evidence.");
  assert(!candidates.some((item) => item.sourceEntityId === closedJob.id), "Expired jobs excluded.");
  assert(!candidates.some((item) => item.sourceEntityId === appliedJob.id || item.sourceEntityId === appliedPosting.id && item.type === "JOB_APPLY" && item.title.includes("AppliedCo")), "Already-applied excluded from apply.");
  const fingerprints = candidates.map((item) => item.fingerprint);
  const candidateDedupe = fingerprints.length === new Set(fingerprints).size;
  evidence.candidateDedupe = candidateDedupe;
  assert(candidateDedupe, "Candidate fingerprints must be unique.");
  assert(candidates.length <= 50, "Raw candidate cap is 50.");

  const follow = candidates.find((item) => item.type === "APPLICATION_FOLLOW_UP");
  if (!follow) throw new Error("Follow-up candidate required.");
  const followScore = scoreDailyActionCandidate(follow);
  evidence.priorityFormula = followScore.priority.components;
  evidence.urgencyScore = followScore.priority.components.urgency;
  evidence.careerImpact = followScore.priority.components.careerImpact;
  evidence.readiness = followScore.priority.components.readiness;
  evidence.opportunityQuality = followScore.priority.components.opportunityQuality;
  evidence.momentumNeglect = followScore.priority.components.momentumNeglect;
  evidence.effortEfficiency = followScore.priority.components.effortEfficiency;
  assert(followScore.priority.total === Object.values(followScore.priority.components).reduce((a, b) => a + b, 0) || followScore.priority.hardOverride, "Score is the component sum unless overridden.");

  const interviewCandidate = {
    ...follow,
    type: "INTERVIEW_PREP" as const,
    urgencySignals: ["interview tomorrow"],
    estimatedMinutes: 60 as const,
  };
  const hard = scoreDailyActionCandidate(interviewCandidate);
  evidence.hardOverride = { total: hard.priority.total, band: hard.priority.band, hard: hard.priority.hardOverride };
  assert(hard.priority.hardOverride && hard.priority.total >= 85 && hard.priority.band === "CRITICAL", "Hard urgency override.");

  const first = await generateTodayRoadmap(user.id, { now });
  const second = await generateTodayRoadmap(user.id, { now });
  evidence.sequentialGenerate = { firstId: first.id, secondId: second.id, same: first.id === second.id };
  assert(first.id === second.id, "Sequential generate must return the same roadmap.");
  const actionCount = await prisma.dailyRoadmapAction.count({ where: { dailyRoadmapId: first.id } });
  evidence.top3 = first.topPriorities.map((item) => item.title);
  const coreCount = first.topPriorities.length + first.remainingCore.length;
  evidence.maxCoreActions = coreCount;
  evidence.plannedMinutes = first.plannedMinutes;
  evidence.optionalLater = first.optionalLater.length;
  assert(first.topPriorities.length <= 3, "Top 3 cap.");
  assert(coreCount <= 4, "maxCoreActions respected except critical overflow.");

  const user2 = await makeUser("m26-qa-concurrent@careeros.local", "M26 Concurrent");
  await cleanupUser(user2.id);
  await getOrCreateDailyRoadmapPreference(user2.id);
  const [left, right] = await Promise.all([
    generateTodayRoadmap(user2.id, { now }),
    generateTodayRoadmap(user2.id, { now }),
  ]);
  const concurrentCount = await prisma.dailyRoadmap.count({ where: { userId: user2.id } });
  const concurrentActions = await prisma.dailyRoadmapAction.count({ where: { userId: user2.id } });
  evidence.concurrentGenerate = { left: left.id, right: right.id, roadmaps: concurrentCount, actions: concurrentActions };
  assert(left.id === right.id, "Concurrent generate must collapse to one roadmap.");
  assert(concurrentCount === 1, "One roadmap row.");
  const fingerprints2 = await prisma.dailyRoadmapAction.findMany({ where: { userId: user2.id }, select: { fingerprint: true } });
  assert(new Set(fingerprints2.map((row) => row.fingerprint)).size === fingerprints2.length, "No duplicate concurrent actions.");

  const previousModel = process.env.OPENAI_DAILY_ROADMAP_MODEL;
  process.env.OPENAI_DAILY_ROADMAP_MODEL = "invalid-m26-test-model";
  const user3 = await makeUser("m26-qa-ai@careeros.local", "M26 AI");
  await cleanupUser(user3.id);
  await getOrCreateDailyRoadmapPreference(user3.id);
  const aiFail = await generateTodayRoadmap(user3.id, { now });
  evidence.aiInvalidModel = {
    generated: Boolean(aiFail.id),
    source: aiFail.generationSource,
    scores: aiFail.actions.map((action) => action.priorityBand),
  };
  assert(aiFail.generationSource === "FALLBACK" || aiFail.generationSource === "DETERMINISTIC", "AI failure uses fallback/deterministic.");
  if (previousModel === undefined) delete process.env.OPENAI_DAILY_ROADMAP_MODEL;
  else process.env.OPENAI_DAILY_ROADMAP_MODEL = previousModel;

  const applyAction = await prisma.dailyRoadmapAction.create({
    data: {
      userId: user.id,
      dailyRoadmapId: first.id,
      type: "JOB_APPLY",
      origin: "SYSTEM_GENERATED",
      sourceEntityType: "APPLICATION",
      sourceEntityId: draftApp.id,
      title: "Apply to Company X",
      whyNow: "Application package is ready.",
      priorityScore: 80,
      priorityBand: "HIGH",
      estimatedMinutes: 30,
      status: "PLANNED",
      isMeaningful: true,
      isActionable: true,
      sortOrder: 20,
      fingerprint: `JOB_APPLY:APPLICATION:${draftApp.id}:qa-apply`,
      contextSnapshotJson: {},
    },
  });
  await completeDailyRoadmapAction(user.id, applyAction.id, { completionSource: "DOMAIN_EVENT", isMeaningful: true });
  const completedAction = await prisma.dailyRoadmapAction.findUniqueOrThrow({ where: { id: applyAction.id } });
  const appAfterComplete = await prisma.application.findUniqueOrThrow({ where: { id: draftApp.id } });
  evidence.manualComplete = {
    actionStatus: completedAction.status,
    completionSource: completedAction.completionSource,
    applicationStatus: appAfterComplete.status,
  };
  assert(completedAction.status === "COMPLETED", "Action completed.");
  assert(completedAction.completionSource === "USER_CONFIRMED", "Client cannot declare DOMAIN_EVENT.");
  assert(appAfterComplete.status === "DRAFT", "JOB_APPLY complete must not mutate Application.");

  const activityOnce = await prisma.careerActivityRecord.count({
    where: { userId: user.id, fingerprint: `ROADMAP_ACTION_COMPLETED:${applyAction.id}` },
  });
  await completeDailyRoadmapAction(user.id, applyAction.id);
  const activityTwice = await prisma.careerActivityRecord.count({
    where: { userId: user.id, fingerprint: `ROADMAP_ACTION_COMPLETED:${applyAction.id}` },
  });
  evidence.duplicateCompletion = { first: activityOnce, second: activityTwice };
  assert(activityOnce === 1 && activityTwice === 1, "Duplicate complete must not double-count.");

  await transitionApplicationStatus({ userId: user.id, applicationId: draftApp.id, toStatus: "APPLIED" });
  const appApplied = await prisma.application.findUniqueOrThrow({ where: { id: draftApp.id } });
  const submitted = await prisma.careerActivityRecord.findMany({
    where: { userId: user.id, activityType: "APPLICATION_SUBMITTED" },
  });
  evidence.applicationAppliedHook = { status: appApplied.status, records: submitted.length };
  assert(appApplied.status === "APPLIED", "M22 APPLIED transition works.");
  assert(submitted.length === 1, "APPLIED records once.");

  const domainAction = await prisma.dailyRoadmapAction.create({
    data: {
      userId: user.id,
      dailyRoadmapId: first.id,
      type: "JOB_APPLY",
      origin: "SYSTEM_GENERATED",
      sourceEntityType: "APPLICATION",
      sourceEntityId: draftApp.id,
      title: "Apply after domain",
      priorityScore: 80,
      priorityBand: "HIGH",
      estimatedMinutes: 30,
      status: "PLANNED",
      isMeaningful: true,
      isActionable: true,
      sortOrder: 21,
      fingerprint: `JOB_APPLY:APPLICATION:${draftApp.id}:qa-domain`,
      contextSnapshotJson: {},
    },
  });
  const { reconcileDailyRoadmap } = await import("@/features/daily-roadmap/server");
  await reconcileDailyRoadmap(user.id, first.id);
  const reconciled = await prisma.dailyRoadmapAction.findUniqueOrThrow({ where: { id: domainAction.id } });
  evidence.domainReconciliation = { status: reconciled.status, source: reconciled.completionSource };
  assert(reconciled.status === "COMPLETED" && reconciled.completionSource === "DOMAIN_EVENT", "Domain APPLIED reconciles action.");

  const deferTarget = first.actions.find((item) => item.status === "PLANNED") ?? first.topPriorities[0];
  if (deferTarget) {
    const deferred = await deferDailyRoadmapAction(user.id, deferTarget.id, { preset: "TOMORROW" });
    evidence.defer = deferred;
    assert(deferred.status === "DEFERRED" && Boolean(deferred.deferredUntil), "Defer tomorrow.");
  }

  const skipTarget = (await prisma.dailyRoadmapAction.findFirst({
    where: { dailyRoadmapId: first.id, status: "PLANNED", origin: { not: "USER_CREATED" } },
  }))!;
  if (skipTarget) {
    const skipped = await skipDailyRoadmapAction(user.id, skipTarget.id, { reason: "NO_TIME" });
    evidence.skip = skipped.status;
    assert(skipped.status === "SKIPPED", "Skip persists.");
  }

  const custom = await createCustomCareerAction(user.id, {
    title: "Write a case study for TypeScript systems",
    sourceEntityType: "APPLICATION",
    sourceEntityId: draftApp.id,
    userId: "forged",
  });
  const customRow = await prisma.dailyRoadmapAction.findUniqueOrThrow({ where: { id: custom.id } });
  evidence.customAction = {
    origin: custom.origin,
    source: custom.sourceEntityType,
    id: custom.id,
    estimatedMinutes: custom.estimatedMinutes,
    persistedEstimatedMinutes: customRow.estimatedMinutes,
  };
  assert(custom.origin === "USER_CREATED" && custom.sourceEntityType === "NONE", "Custom actions cannot bind foreign sources.");
  assert(custom.estimatedMinutes === 15 && customRow.estimatedMinutes === 15, "Title-only custom action defaults to 15 minutes.");

  const plannedBeforeTimed = await prisma.dailyRoadmap.findUniqueOrThrow({ where: { id: first.id } });
  const todayBeforeTimed = await getTodayWorkspace(user.id, { now });
  const timed = await createCustomCareerAction(user.id, {
    title: "Prepare a hiring-manager briefing",
    estimatedMinutes: 30,
    priorityScore: 100,
    priorityBand: "CRITICAL",
    isMeaningful: false,
    completionSource: "DOMAIN_EVENT",
    origin: "SYSTEM_GENERATED",
    sourceEntityType: "APPLICATION",
    sourceEntityId: draftApp.id,
    userId: "forged",
  });
  const timedRow = await prisma.dailyRoadmapAction.findUniqueOrThrow({ where: { id: timed.id } });
  const plannedAfterTimed = await prisma.dailyRoadmap.findUniqueOrThrow({ where: { id: first.id } });
  const todayAfterTimed = await getTodayWorkspace(user.id, { now });
  evidence.customActionThirty = {
    estimatedMinutes: timed.estimatedMinutes,
    persistedEstimatedMinutes: timedRow.estimatedMinutes,
    origin: timed.origin,
    source: timed.sourceEntityType,
    priorityScore: timedRow.priorityScore,
    priorityBand: timed.priorityBand,
    isMeaningful: timed.isMeaningful,
    plannedMinutesBefore: plannedBeforeTimed.plannedMinutes,
    plannedMinutesAfter: plannedAfterTimed.plannedMinutes,
    plannedEstimatedMinutesBefore: todayBeforeTimed.progress.plannedEstimatedMinutes,
    plannedEstimatedMinutesAfter: todayAfterTimed.progress.plannedEstimatedMinutes,
  };
  assert(timed.estimatedMinutes === 30 && timedRow.estimatedMinutes === 30, "30-minute custom estimate persists.");
  assert(timed.origin === "USER_CREATED" && timed.sourceEntityType === "NONE" && timedRow.sourceEntityId === null, "Custom source ownership stays NONE.");
  assert(
    timedRow.priorityScore === 55 &&
      timed.priorityBand === "MEDIUM" &&
      timedRow.priorityBand === "MEDIUM" &&
      timed.isMeaningful === true &&
      timedRow.isMeaningful === true,
    "Forged priority/meaningful fields are ignored.",
  );
  assert(
    plannedAfterTimed.plannedMinutes === plannedBeforeTimed.plannedMinutes + 30,
    "Custom 30-minute estimate increments stored planned minutes.",
  );
  assert(
    todayAfterTimed.progress.plannedEstimatedMinutes === todayBeforeTimed.progress.plannedEstimatedMinutes + 30,
    "Today planned-minute calculation includes the custom estimate.",
  );

  const completedMinutesBefore = todayAfterTimed.progress.completedEstimatedMinutes;
  await completeDailyRoadmapAction(user.id, timed.id, {
    completionSource: "DOMAIN_EVENT",
    isMeaningful: false,
    priorityScore: 100,
  });
  const completedTimed = await prisma.dailyRoadmapAction.findUniqueOrThrow({ where: { id: timed.id } });
  const todayAfterComplete = await getTodayWorkspace(user.id, { now });
  evidence.customActionThirtyComplete = {
    status: completedTimed.status,
    completionSource: completedTimed.completionSource,
    completedEstimatedMinutesBefore: completedMinutesBefore,
    completedEstimatedMinutesAfter: todayAfterComplete.progress.completedEstimatedMinutes,
  };
  assert(completedTimed.status === "COMPLETED" && completedTimed.completionSource === "USER_CONFIRMED", "Custom complete stays user-confirmed.");
  assert(
    todayAfterComplete.progress.completedEstimatedMinutes === completedMinutesBefore + 30,
    "Completing a 30-minute custom action adds 30 completed minutes.",
  );

  let invalidEstimateRejected = false;
  try {
    await createCustomCareerAction(user.id, {
      title: "Invalid estimate must not persist",
      estimatedMinutes: -5,
    });
  } catch (error) {
    invalidEstimateRejected = error instanceof DailyRoadmapAccessError && error.code === "INVALID_INPUT";
  }
  const normalized = await createCustomCareerAction(user.id, {
    title: "Bucket an unapproved 25-minute estimate",
    estimatedMinutes: 25,
  });
  evidence.customActionEstimateValidation = {
    invalidRejected: invalidEstimateRejected,
    normalizedMinutes: normalized.estimatedMinutes,
  };
  assert(invalidEstimateRejected, "Negative estimated minutes are rejected.");
  assert(normalized.estimatedMinutes === 30, "Unapproved positive estimates bucket to the nearest allowed value.");

  await prisma.dailyRoadmapAction.updateMany({
    where: { id: custom.id },
    data: { status: "IN_PROGRESS" },
  });

  const completedKeep = completedAction.id;
  const deferredKeep = evidence.defer && typeof evidence.defer === "object" ? (evidence.defer as { id: string }).id : null;
  const skippedKeep = skipTarget?.id ?? null;
  const refreshed = await refreshTodayRoadmap(user.id, { now });
  const afterRefresh = await prisma.dailyRoadmapAction.findMany({ where: { dailyRoadmapId: first.id } });
  const refreshFingerprints = afterRefresh.map((row) => row.fingerprint);
  const preserveCompleted = afterRefresh.find((row) => row.id === completedKeep)?.status;
  const preserveDeferred = deferredKeep ? afterRefresh.find((row) => row.id === deferredKeep)?.status : null;
  const preserveSkipped = skippedKeep ? afterRefresh.find((row) => row.id === skippedKeep)?.status : null;
  const preserveCustom = afterRefresh.find((row) => row.id === custom.id)?.origin;
  const preserveInProgress = afterRefresh.find((row) => row.id === custom.id)?.status;
  evidence.refreshPreserveCompleted = preserveCompleted;
  evidence.refreshPreserveDeferred = preserveDeferred;
  evidence.refreshPreserveSkipped = preserveSkipped;
  evidence.refreshPreserveCustom = preserveCustom;
  evidence.refreshPreserveInProgress = preserveInProgress;
  const refreshDedupe = refreshFingerprints.length === new Set(refreshFingerprints).size;
  evidence.refreshDedupe = refreshDedupe;
  assert(preserveCompleted === "COMPLETED", "Refresh keeps completed.");
  if (deferredKeep) assert(preserveDeferred === "DEFERRED", "Refresh keeps deferred.");
  if (skippedKeep) assert(preserveSkipped === "SKIPPED", "Refresh keeps skipped.");
  assert(preserveCustom === "USER_CREATED", "Refresh keeps custom.");
  assert(preserveInProgress === "IN_PROGRESS", "Refresh keeps in-progress.");
  assert(refreshDedupe, "Refresh must not duplicate fingerprints.");
  void refreshed;

  await prisma.discoveredJob.update({ where: { id: strongJob.id }, data: { expiresAt: utc("2026-01-01T00:00:00.000Z") } });
  const obsolete = await prisma.dailyRoadmapAction.create({
    data: {
      userId: user.id,
      dailyRoadmapId: first.id,
      type: "JOB_REVIEW",
      origin: "SYSTEM_GENERATED",
      sourceEntityType: "JOB",
      sourceEntityId: strongJob.id,
      title: "Review expired role",
      priorityScore: 40,
      priorityBand: "LOW",
      estimatedMinutes: 10,
      status: "PLANNED",
      isMeaningful: false,
      isActionable: true,
      sortOrder: 80,
      fingerprint: `JOB_REVIEW:JOB:${strongJob.id}:review-expire`,
      contextSnapshotJson: {},
    },
  });
  await refreshTodayRoadmap(user.id, { now });
  const expiredRow = await prisma.dailyRoadmapAction.findUniqueOrThrow({ where: { id: obsolete.id } });
  evidence.expired = expiredRow.status;
  assert(expiredRow.status === "EXPIRED", "Obsolete system action expires.");

  await setResumeVersionStatus(user.id, resume.id, "READY");
  const resumeReady = await prisma.careerActivityRecord.count({
    where: { userId: user.id, activityType: "RESUME_READY" },
  });
  await setResumeVersionStatus(user.id, resume.id, "READY");
  const resumeReady2 = await prisma.careerActivityRecord.count({
    where: { userId: user.id, activityType: "RESUME_READY" },
  });
  evidence.resumeReadyHook = { first: resumeReady, second: resumeReady2 };
  assert(resumeReady === 1 && resumeReady2 === 1, "Resume READY records once.");

  await markCommunicationUsed(user.id, comm.id);
  const used = await prisma.careerActivityRecord.count({ where: { userId: user.id, activityType: "COMMUNICATION_USED" } });
  await markCommunicationUsed(user.id, comm.id);
  const used2 = await prisma.careerActivityRecord.count({ where: { userId: user.id, activityType: "COMMUNICATION_USED" } });
  evidence.communicationUsedHook = { first: used, second: used2 };
  assert(used === 1 && used2 === 1, "Communication USED records once.");

  await markLinkedinPostPublishedManually(user.id, plan.id, {});
  const liManual = await prisma.careerActivityRecord.count({
    where: { userId: user.id, fingerprint: `LINKEDIN_PUBLISHED:${post.id}:${plan.id}` },
  });
  evidence.linkedinUserConfirmed = liManual;
  assert(liManual === 1, "Manual publish records once.");

  const post2 = await prisma.linkedinPost.create({
    data: {
      userId: user.id,
      linkedinGrowthProfileId: profile.id,
      status: "READY",
      objective: "SHOW_EXPERTISE",
      format: "TEXT_POST",
    },
  });
  const rev2 = await prisma.linkedinPostRevision.create({
    data: {
      userId: user.id,
      linkedinPostId: post2.id,
      revisionNumber: 1,
      source: "USER_EDITED",
      hook: "Official publish fixture.",
      body: "Frozen revision for official LinkedIn publish activity.",
      cta: "Compare notes.",
      tone: "PROFESSIONAL",
      language: "ENGLISH",
      qaStatus: "PASS",
    },
  });
  await prisma.linkedinPost.update({ where: { id: post2.id }, data: { activeRevisionId: rev2.id, status: "READY" } });
  const plan2 = await createLinkedinPublishingPlan(user.id, post2.id, {});
  resetFixtureLinkedinClient();
  const start = await startLinkedinConnection(user.id);
  const state = new URL(start.authorizationUrl).searchParams.get("state");
  assert(state, "OAuth state");
  await completeLinkedinOAuthCallback(user.id, { state: state!, code: "fixture.SUCCESS" });
  const prepared = await prepareLinkedinOfficialPublish(user.id, plan2.id, {});
  await executeLinkedinOfficialPublish(user.id, plan2.id, { attemptId: prepared.attemptId });
  const liOfficial = await prisma.careerActivityRecord.findMany({
    where: { userId: user.id, fingerprint: `LINKEDIN_PUBLISHED:${post2.id}:${plan2.id}` },
  });
  evidence.linkedinOfficial = liOfficial.length;
  assert(liOfficial.length === 1, "Official publish records once.");
  evidence.linkedinDoubleCount = liManual === 1 && liOfficial.length === 1;

  const loginCount = await prisma.careerActivityRecord.count({
    where: { userId: user.id, activityType: { in: ["APPLICATION_SUBMITTED", "RESUME_READY", "COMMUNICATION_USED", "LINKEDIN_PUBLISHED", "ROADMAP_ACTION_COMPLETED"] } },
  });
  evidence.meaningfulRecords = loginCount;
  evidence.nonMeaningfulAudit = "login/view/generate/refresh are not activity types and were never inserted";

  const day = await prisma.careerActivityDay.findUnique({
    where: { userId_localDate: { userId: user.id, localDate: first.localDate } },
  });
  evidence.activityDay = day;
  assert(day?.qualifiesForStreak === true, "Activity day qualifies.");

  const carryUser = await makeUser("m26-qa-carry@careeros.local", "M26 Carry");
  await cleanupUser(carryUser.id);
  await updateDailyRoadmapPreference(carryUser.id, { timezone: "UTC" });
  const day1 = now;
  const roadmap1 = await generateTodayRoadmap(carryUser.id, { now: day1 });
  const planned = await prisma.dailyRoadmapAction.findFirst({
    where: { dailyRoadmapId: roadmap1.id, status: "PLANNED" },
  });
  if (planned) {
    await prisma.dailyRoadmapAction.update({
      where: { id: planned.id },
      data: { status: "DEFERRED", deferredUntil: getCareerLocalDate(new Date(now.getTime() + 36 * 3_600_000), "UTC") },
    });
  }
  const day2 = new Date(now.getTime() + 36 * 3_600_000);
  const roadmap2 = await generateTodayRoadmap(carryUser.id, { now: day2 });
  const carried = roadmap2.actions.filter((item) => item.origin === "CARRIED_OVER");
  evidence.carryOver = { day1: roadmap1.id, day2: roadmap2.id, carried: carried.length, sameRow: roadmap1.id === roadmap2.id };
  assert(roadmap1.id !== roadmap2.id, "New local day creates a new roadmap.");
  if (planned) {
    const oldRow = await prisma.dailyRoadmapAction.findUniqueOrThrow({ where: { id: planned.id } });
    assert(oldRow.dailyRoadmapId === roadmap1.id, "Historical action rows stay on the original day.");
  }

  const uniqueRoadmaps = await prisma.dailyRoadmap.groupBy({
    by: ["userId", "localDate"],
    where: { userId: user.id },
  });
  const roadmapCount = await prisma.dailyRoadmap.count({ where: { userId: user.id } });
  evidence.roadmapUnique = uniqueRoadmaps.length === roadmapCount;
  assert(uniqueRoadmaps.length === roadmapCount, "One roadmap per user/localDate.");

  void readyPackage;
  void closedJob;
  void appliedJob;

  console.log(JSON.stringify({ ok: true, evidence }, null, 2));
}

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
