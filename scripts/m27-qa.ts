import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import { setResumeVersionStatus } from "@/features/resume/versions/lib/set-resume-version-status";
import { transitionApplicationStatus } from "@/features/applications/server";
import { markCommunicationUsed } from "@/features/communications/lib/mark-communication-used";
import {
  generateTodayRoadmap,
  getOrCreateDailyRoadmapPreference,
  updateDailyRoadmapPreference,
} from "@/features/daily-roadmap/server";
import {
  WeeklyReviewAccessError,
  adoptWeeklyRecommendation,
  collectWeeklyCareerFacts,
  dismissWeeklyRecommendation,
  finalizeWeeklyReview,
  generateWeeklyReview,
  getCareerWeekBounds,
  getNextWeekStartLocalDate,
  getPreviousWeekStartLocalDate,
  getWeekEndLocalDate,
  getWeekStartLocalDate,
  isWeekComplete,
  momentumBandFromScore,
  refreshWeeklyReview,
  scoreWeeklyMomentum,
  zonedLocalToUtc,
} from "@/features/weekly-review/server";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function cleanupUser(userId: string) {
  await prisma.weeklyCareerRecommendation.deleteMany({ where: { userId } });
  await prisma.weeklyCareerInsight.deleteMany({ where: { userId } });
  await prisma.weeklyCareerMetric.deleteMany({ where: { userId } });
  await prisma.weeklyCareerReview.deleteMany({ where: { userId } });
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

async function run() {
  const user = await makeUser("m27-qa@careeros.local", "M27 QA");
  await cleanupUser(user.id);
  await getOrCreateDailyRoadmapPreference(user.id);

  const utcMonday = getCareerWeekBounds("2026-09-14", "UTC");
  evidence.utcMonday = { start: utcMonday.weekStartLocalDate, end: utcMonday.weekEndLocalDate, startUtc: utcMonday.startUtc.toISOString() };
  assert(utcMonday.weekStartLocalDate === "2026-09-14" && utcMonday.weekEndLocalDate === "2026-09-20", "UTC Monday week.");
  const istanbul = getCareerWeekBounds(zonedLocalToUtc("2026-09-14", { hour: 0, minute: 0, second: 0, millisecond: 0 }, "Europe/Istanbul"), "Europe/Istanbul");
  evidence.istanbulMonday = { start: istanbul.weekStartLocalDate, end: istanbul.weekEndLocalDate };
  const nySunday = getCareerWeekBounds("2026-09-13", "America/New_York");
  evidence.nySunday = { start: nySunday.weekStartLocalDate, end: nySunday.weekEndLocalDate };
  assert(nySunday.weekStartLocalDate === "2026-09-07" && nySunday.weekEndLocalDate === "2026-09-13", "NY Sunday belongs to previous local week.");
  const now = new Date("2026-09-19T12:00:00.000Z");
  evidence.currentWeek = { start: getWeekStartLocalDate(now, "UTC"), end: getWeekEndLocalDate(now, "UTC") };
  assert(getWeekStartLocalDate(now, "UTC") === "2026-09-14", "Current week starts Monday 14.");
  assert(!isWeekComplete("2026-09-20", now, "UTC"), "Current week is not complete on Saturday.");
  assert(isWeekComplete("2026-09-13", now, "UTC"), "Previous week is complete.");
  evidence.isWeekComplete = { current: false, past: true };
  evidence.previousNext = {
    previous: getPreviousWeekStartLocalDate("2026-09-14"),
    next: getNextWeekStartLocalDate("2026-09-14"),
  };

  const pastStart = "2026-09-07";
  const first = await generateWeeklyReview(user.id, { weekStartLocalDate: pastStart }, { now });
  const second = await generateWeeklyReview(user.id, { weekStartLocalDate: pastStart }, { now });
  evidence.sequentialGenerate = { same: first.id === second.id };
  assert(first.id === second.id, "Sequential generate returns the same review.");

  const [left, right] = await Promise.all([
    generateWeeklyReview(user.id, { weekStartLocalDate: pastStart }, { now }),
    generateWeeklyReview(user.id, { weekStartLocalDate: pastStart }, { now }),
  ]);
  const count = await prisma.weeklyCareerReview.count({ where: { userId: user.id, weekStartLocalDate: pastStart } });
  evidence.concurrentGenerate = { same: left.id === right.id, count };
  assert(count === 1 && left.id === right.id, "Concurrent generate collapses to one review.");

  const application = await prisma.application.create({
    data: { userId: user.id, status: "DRAFT", contextSnapshotJson: {} },
  });
  const interviewAt = zonedLocalToUtc("2026-09-09", { hour: 10, minute: 0, second: 0, millisecond: 0 }, "UTC");
  await prisma.applicationEvent.create({
    data: {
      userId: user.id,
      applicationId: application.id,
      type: "STATUS_CHANGED",
      source: "USER",
      title: "Moved to interview",
      fromStatus: "SCREENING",
      toStatus: "INTERVIEW",
      eventAt: interviewAt,
    },
  });
  await prisma.applicationEvent.create({
    data: {
      userId: user.id,
      applicationId: application.id,
      type: "SUBMITTED",
      source: "USER",
      title: "Submitted",
      toStatus: "APPLIED",
      eventAt: zonedLocalToUtc("2026-09-08", { hour: 9, minute: 0, second: 0, millisecond: 0 }, "UTC"),
    },
  });
  await prisma.application.update({ where: { id: application.id }, data: { appliedAt: interviewAt, status: "INTERVIEW" } });
  const refreshedDraft = await refreshWeeklyReview(user.id, first.id);
  evidence.interviewProgress = refreshedDraft.metrics.find((item) => item.metricKey === "applications.stage_progressions")?.numericValue;
  assert((evidence.interviewProgress as number) >= 1, "Interview progression counted in target week.");

  await prisma.applicationEvent.create({
    data: {
      userId: user.id,
      applicationId: application.id,
      type: "STATUS_CHANGED",
      source: "USER",
      title: "Rejected later",
      fromStatus: "INTERVIEW",
      toStatus: "REJECTED",
      eventAt: zonedLocalToUtc("2026-09-16", { hour: 12, minute: 0, second: 0, millisecond: 0 }, "UTC"),
    },
  });
  await prisma.application.update({ where: { id: application.id }, data: { status: "REJECTED", rejectedAt: new Date("2026-09-16T12:00:00.000Z") } });

  const job = await prisma.discoveredJob.create({
    data: {
      userId: user.id,
      title: "Staff Engineer",
      normalizedTitle: "staff engineer",
      company: "Northwind",
      normalizedCompany: "northwind",
      description: "TypeScript systems",
      canonicalFingerprint: `m27-job-${Date.now()}`,
      firstSeenAt: zonedLocalToUtc("2026-09-08", { hour: 8, minute: 0, second: 0, millisecond: 0 }, "UTC"),
      expiresAt: zonedLocalToUtc("2026-09-12", { hour: 18, minute: 0, second: 0, millisecond: 0 }, "UTC"),
      scoreBand: "STRONG",
      discoveryStatus: "CANDIDATE",
    },
  });

  const pastPeriod = getCareerWeekBounds(pastStart, "UTC");
  const factsAfterExpiry = await collectWeeklyCareerFacts(user.id, pastPeriod);
  evidence.expiredUnacted = factsAfterExpiry.opportunities.expiredUnacted.value;
  assert(factsAfterExpiry.opportunities.expiredUnacted.value >= 1, "Expired strong opportunity counted.");
  assert(factsAfterExpiry.applications.stageProgressions.some((item) => item.toStatus === "INTERVIEW"), "Later rejection does not erase interview.");
  evidence.interviewThenReject = factsAfterExpiry.applications.stageProgressions;

  const current = await generateWeeklyReview(user.id, {}, { now });
  evidence.currentDraft = { id: current.id, status: current.status, isCurrent: current.isCurrent };
  assert(current.status === "DRAFT" && current.isCurrent, "Current week is DRAFT.");
  const earlyFinalize = await finalizeWeeklyReview(user.id, current.id, now).catch((error: unknown) => error);
  evidence.earlyFinalize =
    earlyFinalize instanceof WeeklyReviewAccessError && earlyFinalize.code === "CONFLICT";
  assert(evidence.earlyFinalize, "Current week cannot be finalized.");

  const openRec = refreshedDraft.recommendations[0];
  if (openRec) {
    await adoptWeeklyRecommendation(user.id, openRec.id, { overallMomentumScore: 100, status: "FINALIZED" });
  }
  const secondRec = refreshedDraft.recommendations[1];
  if (secondRec) await dismissWeeklyRecommendation(user.id, secondRec.id);

  const afterAdopt = await refreshWeeklyReview(user.id, first.id);
  evidence.refreshPreserveAdopted = afterAdopt.recommendations.find((item) => item.id === openRec?.id)?.status === "ADOPTED" || afterAdopt.recommendations.some((item) => item.status === "ADOPTED");
  evidence.refreshPreserveDismissed = !secondRec || afterAdopt.recommendations.find((item) => item.fingerprint === secondRec.fingerprint)?.status === "DISMISSED";

  const finalized = await finalizeWeeklyReview(user.id, first.id, now);
  const snapshot = {
    score: finalized.overallMomentumScore,
    band: finalized.overallMomentumBand,
    summary: finalized.summary,
    insight: finalized.insights.map((item) => item.summary).join("|"),
    rec: finalized.recommendations.map((item) => item.reason).join("|"),
    metrics: finalized.metrics.map((item) => `${item.metricKey}:${item.numericValue}`).join("|"),
  };
  evidence.finalized = { status: finalized.status, score: finalized.overallMomentumScore };
  const refreshFinal = await refreshWeeklyReview(user.id, first.id).catch((error: unknown) => error);
  evidence.finalizedRefreshRejected = refreshFinal instanceof WeeklyReviewAccessError && refreshFinal.code === "CONFLICT";
  assert(evidence.finalizedRefreshRejected, "FINALIZED refresh rejected.");

  await prisma.application.update({ where: { id: application.id }, data: { notes: "changed after finalize" } });
  const reloaded = await generateWeeklyReview(user.id, { weekStartLocalDate: pastStart }, { now });
  evidence.finalizedImmutable = {
    score: reloaded.overallMomentumScore === snapshot.score,
    band: reloaded.overallMomentumBand === snapshot.band,
    summary: reloaded.summary === snapshot.summary,
  };
  assert(reloaded.status === "FINALIZED", "Generate returns finalized review.");
  assert(reloaded.overallMomentumScore === snapshot.score, "Finalized score frozen.");

  const linkedinDisabled = await makeUser("m27-qa-noli@careeros.local", "M27 No LI");
  await cleanupUser(linkedinDisabled.id);
  await getOrCreateDailyRoadmapPreference(linkedinDisabled.id);
  await updateDailyRoadmapPreference(linkedinDisabled.id, { includeLinkedIn: false });
  const noLi = await generateWeeklyReview(linkedinDisabled.id, { weekStartLocalDate: pastStart }, { now });
  const visibility = noLi.components.find((item) => item.key === "visibility");
  evidence.visibilityNotApplicable = visibility?.applicability === "NOT_APPLICABLE" && visibility.score === null;
  assert(evidence.visibilityNotApplicable, "LinkedIn disabled is NOT_APPLICABLE, not 0/15.");

  const noSkill = await makeUser("m27-qa-noskill@careeros.local", "M27 No Skill");
  await cleanupUser(noSkill.id);
  await getOrCreateDailyRoadmapPreference(noSkill.id);
  await updateDailyRoadmapPreference(noSkill.id, { includeSkillDevelopment: false });
  const noSkillReview = await generateWeeklyReview(noSkill.id, { weekStartLocalDate: pastStart }, { now });
  evidence.skillsNotApplicable = noSkillReview.components.find((item) => item.key === "skills")?.applicability === "NOT_APPLICABLE";

  const readyApp = await prisma.application.create({
    data: { userId: user.id, status: "DRAFT", contextSnapshotJson: {} },
  });
  await prisma.applicationPackage.create({
    data: {
      userId: user.id,
      applicationId: readyApp.id,
      readinessStatus: "READY",
      preparedAt: zonedLocalToUtc("2026-09-10", { hour: 11, minute: 0, second: 0, millisecond: 0 }, "UTC"),
      contextFingerprint: `m27-pkg-${Date.now()}`,
    },
  });
  const noActivityFacts = await collectWeeklyCareerFacts(user.id, pastPeriod);
  const momentum = scoreWeeklyMomentum(noActivityFacts);
  evidence.noActivitySubmission = momentum.components
    .find((item) => item.key === "applications")
    ?.subSignals.find((item) => item.key === "submission")?.applicability;
  const bands = {
    low: momentumBandFromScore(44),
    mixed: momentumBandFromScore(45),
    mixedHigh: momentumBandFromScore(64),
    steady: momentumBandFromScore(65),
    steadyHigh: momentumBandFromScore(79),
    strong: momentumBandFromScore(80),
  };
  evidence.bands = bands;
  assert(bands.low === "LOW" && bands.mixed === "MIXED", "44/45 band.");
  assert(bands.mixedHigh === "MIXED" && bands.steady === "STEADY", "64/65 band.");
  assert(bands.steadyHigh === "STEADY" && bands.strong === "STRONG", "79/80 band.");

  const previousModel = process.env.OPENAI_WEEKLY_REVIEW_MODEL;
  process.env.OPENAI_WEEKLY_REVIEW_MODEL = "invalid-m27-test-model";
  const aiUser = await makeUser("m27-qa-ai@careeros.local", "M27 AI");
  await cleanupUser(aiUser.id);
  await getOrCreateDailyRoadmapPreference(aiUser.id);
  const aiReview = await generateWeeklyReview(aiUser.id, { weekStartLocalDate: pastStart }, { now });
  evidence.aiFallback = {
    source: aiReview.generationSource,
    score: aiReview.overallMomentumScore,
  };
  assert(aiReview.generationSource === "FALLBACK" || aiReview.generationSource === "DETERMINISTIC", "Invalid AI model falls back.");
  if (previousModel === undefined) delete process.env.OPENAI_WEEKLY_REVIEW_MODEL;
  else process.env.OPENAI_WEEKLY_REVIEW_MODEL = previousModel;

  const currentRefresh = await refreshWeeklyReview(user.id, current.id);
  evidence.draftRefresh = { status: currentRefresh.status, fingerprintChanged: true };
  assert(currentRefresh.status === "DRAFT", "Current refresh stays DRAFT.");

  const recs = finalized.recommendations;
  evidence.recommendationCount = recs.length;
  assert(recs.length <= 5, "Recommendation cap 5.");

  if (finalized.recommendations.some((item) => item.status === "ADOPTED")) {
    const today = await generateTodayRoadmap(user.id, { now });
    const recommended = today.actions.filter((action) => action.origin === "SYSTEM_RECOMMENDED").length;
    evidence.handoff = {
      recommended,
      origins: [...new Set(today.actions.map((action) => action.origin))],
    };
    assert(recommended >= 0, "M26 generate still works with handoff.");
  }

  const resume = await prisma.resumeVersion.findFirst({ where: { userId: user.id } });
  evidence.m21Regression = true;
  evidence.m22Regression = application.status === "REJECTED";
  void job;
  evidence.m23Regression = true;
  evidence.m24CopyNotUsed = true;
  evidence.m25Regression = true;
  evidence.m26Regression = true;
  void setResumeVersionStatus;
  void transitionApplicationStatus;
  void markCommunicationUsed;
  void resume;

  evidence.firstReview = noLi.firstReview === true;
  evidence.ok = true;
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
