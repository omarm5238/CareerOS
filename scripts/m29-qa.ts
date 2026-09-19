import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import { getApplicationsForUser } from "@/features/applications/lib/get-applications-for-user";
import { getJobPostingsForUser } from "@/features/jobs/lib/get-job-postings-for-user";
import { listLinkedinPosts } from "@/features/linkedin/posts/get-linkedin-post";
import { getCareerMemoryWorkspace, refreshCareerMemory } from "@/features/career-memory/server";
import { getWeeklyReviewWorkspace } from "@/features/weekly-review/review/get-workspace";
import { generateTodayRoadmap, getOrCreateDailyRoadmapPreference } from "@/features/daily-roadmap/server";
import { exportWorkspaceDataForUser, getSettingsModuleDataForUser, stripExportSecrets } from "@/features/settings/server";
import { setResumeVersionStatus } from "@/features/resume/versions/lib/set-resume-version-status";
import { transitionApplicationStatus } from "@/features/applications/lib/transition-application-status";
import { markCommunicationUsed } from "@/features/communications/lib/mark-communication-used";
import { completeDailyRoadmapAction } from "@/features/daily-roadmap/server";
import { generateWeeklyReview } from "@/features/weekly-review/server";
import { seedM29LongTermDataset } from "./m29-long-term-dataset";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asRecord(item));
}

function idsOf(rows: Record<string, unknown>[]): string[] {
  return rows.map((row) => String(row.id ?? ""));
}

function uniqueIds(ids: string[]): boolean {
  return ids.length === new Set(ids).size;
}

async function makeUser(email: string, name: string) {
  return (
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.create({ data: { email, name, emailVerified: false } }))
  );
}

async function run() {
  const user = await makeUser("m29-qa@careeros.local", "M29 QA");
  const settings = await getSettingsModuleDataForUser(user.id);
  evidence.settings = {
    hasProfile: Boolean(settings?.profile.email),
    aiConfigured: settings?.providerStatus.aiConfigured,
    linkedinMode: settings?.providerStatus.linkedinMode,
  };
  assert(settings, "Settings data loads.");

  const exported = asRecord(await exportWorkspaceDataForUser(user.id));
  const exportData = asRecord(exported.data);
  evidence.exportShape = {
    schemaVersion: exported.schemaVersion,
    exportedAt: Boolean(exported.exportedAt),
    careerOSVersion: exported.careerOSVersion,
    hasData: Boolean(exported.data),
    keys: Object.keys(exportData),
  };
  assert(exported.schemaVersion === "m29.1", "Export schemaVersion.");
  assert(typeof exported.exportedAt === "string", "Export exportedAt.");
  assert(exported.careerOSVersion === "0.1.0", "Export careerOSVersion.");
  assert(exported.data && typeof exported.data === "object", "Export data root.");
  for (const key of ["profile", "preferences", "resumes", "jobs", "applications", "communications", "linkedin", "dailyRoadmap", "weeklyReviews", "memory", "settings"]) {
    assert(key in exportData, `Export includes ${key}.`);
  }

  const serialized = JSON.stringify(exported).toLowerCase();
  const exportSecrets = {
    token: serialized.includes("access_token") || serialized.includes("accesstoken"),
    password: serialized.includes("password"),
    encrypted: serialized.includes("encryptedaccesstoken"),
    apiKey: serialized.includes("sk-"),
  };
  evidence.exportSecrets = exportSecrets;
  assert(!exportSecrets.token && !exportSecrets.password && !exportSecrets.encrypted, "Export excludes secrets.");
  const stripped = asRecord(stripExportSecrets({ password: "x", token: "y", keep: "ok" }));
  assert(stripped.keep === "ok" && stripped.password === undefined && stripped.token === undefined, "Secret stripper.");

  const resume = await prisma.resumeVersion.create({
    data: { userId: user.id, title: "M29 Ready Resume", status: "DRAFT" },
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
  const ready = await setResumeVersionStatus(user.id, resume.id, "READY");
  evidence.m21 = ready.status;
  assert(ready.status === "READY", "M21 READY still works.");

  const application = await prisma.application.create({
    data: { userId: user.id, status: "DRAFT", source: "MANUAL", contextSnapshotJson: {} },
  });
  const applied = await transitionApplicationStatus({ userId: user.id, applicationId: application.id, toStatus: "APPLIED" });
  evidence.m22 = applied.status;
  assert(applied.status === "APPLIED", "M22 APPLIED still works.");

  const draft = await prisma.communicationDraft.create({
    data: { userId: user.id, type: "FOLLOW_UP", status: "READY" },
  });
  const used = await markCommunicationUsed(user.id, draft.id);
  evidence.m24 = used.status;
  assert(used.status === "USED", "M24 USED still works.");

  await getOrCreateDailyRoadmapPreference(user.id);
  const today = await generateTodayRoadmap(user.id);
  evidence.m26 = Boolean(today.id);
  const planned = today.actions.find((action) => action.status === "PLANNED" || action.status === "IN_PROGRESS");
  if (planned) {
    const completed = await completeDailyRoadmapAction(user.id, planned.id);
    evidence.m26Complete = completed.status;
    assert(completed.status === "COMPLETED", "M26 complete still works.");
  }

  const review = await generateWeeklyReview(user.id, {});
  evidence.m27 = { id: Boolean(review.id), score: review.overallMomentumScore };
  assert(review.id, "M27 generate still works.");

  await refreshCareerMemory(user.id, { mode: "ON_DEMAND" });
  const memory = await getCareerMemoryWorkspace(user.id);
  evidence.m28 = { memories: memory.memories.length, graph: memory.graph.relations.length };
  assert(Array.isArray(memory.memories), "M28 workspace still loads.");

  const dataset = await seedM29LongTermDataset();
  evidence.dataset = dataset;
  assert(dataset.jobs >= 200, "Long-term dataset has ~250 jobs.");
  assert(dataset.applications >= 80, "Long-term dataset has ~80 applications.");
  assert(dataset.memories >= 150, "Long-term dataset has ~150 memories.");

  const eventHost = await prisma.application.findFirst({
    where: { userId: dataset.userId },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  assert(eventHost, "Dataset has an application for nested event proof.");
  await prisma.applicationEvent.deleteMany({ where: { applicationId: eventHost.id, userId: dataset.userId } });
  await prisma.applicationEvent.createMany({
    data: Array.from({ length: 25 }, (_, index) => ({
      userId: dataset.userId,
      applicationId: eventHost.id,
      type: "NOTE_ADDED" as const,
      title: `Export event ${index}`,
      eventAt: new Date(`2026-01-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`),
    })),
  });

  const started = Date.now();
  const jobs = await getJobPostingsForUser(dataset.userId);
  const apps = await getApplicationsForUser(dataset.userId);
  const posts = await listLinkedinPosts(dataset.userId);
  const mem = await getCareerMemoryWorkspace(dataset.userId);
  const weekly = await getWeeklyReviewWorkspace(dataset.userId);
  const elapsed = Date.now() - started;
  evidence.bounded = {
    jobs: jobs.length,
    applications: apps.length,
    linkedin: posts.length,
    memories: mem.memories.length,
    weeklyHistory: weekly.history.length,
    ms: elapsed,
  };
  assert(jobs.length <= 20, "Jobs list is bounded.");
  assert(apps.length <= 100, "Applications list is bounded.");
  assert(posts.length <= 50, "LinkedIn list is bounded.");
  assert(mem.memories.length <= 80, "Memory workspace is bounded.");
  assert(weekly.history.length <= 12, "Weekly history is bounded.");
  assert(elapsed < 15_000, "Core reads stay usable on long-term data.");

  const completeExport = asRecord(await exportWorkspaceDataForUser(dataset.userId));
  const completeData = asRecord(completeExport.data);
  const exportedJobs = asArray(asRecord(completeData.jobs).postings);
  const exportedApps = asArray(completeData.applications);
  const exportedResumes = asArray(asRecord(completeData.resumes).versions);
  const exportedRevisions = exportedResumes.flatMap((version) => asArray(version.revisions));
  const exportedComms = asArray(completeData.communications);
  const exportedLinkedin = asArray(asRecord(completeData.linkedin).posts);
  const exportedRoadmaps = asArray(asRecord(completeData.dailyRoadmap).roadmaps);
  const exportedReviews = asArray(completeData.weeklyReviews);
  const exportedMemories = asArray(asRecord(completeData.memory).items);
  const exportedEntities = asArray(asRecord(asRecord(completeData.memory).graph).entities);
  const exportedRelations = asArray(asRecord(asRecord(completeData.memory).graph).relations);
  const exportedAppEvents = exportedApps.flatMap((application) => asArray(application.events));
  const hostedEvents = asArray(exportedApps.find((application) => application.id === eventHost.id)?.events);

  const dbIds = {
    jobs: (await prisma.jobPosting.findMany({ where: { userId: dataset.userId }, select: { id: true } })).map((row) => row.id),
    applications: (await prisma.application.findMany({ where: { userId: dataset.userId }, select: { id: true } })).map((row) => row.id),
    revisions: (await prisma.resumeVersionRevision.findMany({ where: { userId: dataset.userId }, select: { id: true } })).map((row) => row.id),
    communications: (await prisma.communicationDraft.findMany({ where: { userId: dataset.userId }, select: { id: true } })).map((row) => row.id),
    linkedin: (await prisma.linkedinPost.findMany({ where: { userId: dataset.userId }, select: { id: true } })).map((row) => row.id),
    roadmaps: (await prisma.dailyRoadmap.findMany({ where: { userId: dataset.userId }, select: { id: true } })).map((row) => row.id),
    reviews: (await prisma.weeklyCareerReview.findMany({ where: { userId: dataset.userId }, select: { id: true } })).map((row) => row.id),
    memories: (await prisma.careerMemory.findMany({ where: { userId: dataset.userId }, select: { id: true } })).map((row) => row.id),
    events: (await prisma.applicationEvent.findMany({ where: { userId: dataset.userId }, select: { id: true } })).map((row) => row.id),
  };

  evidence.exportCompleteness = {
    jobs: { seeded: dbIds.jobs.length, exported: exportedJobs.length, ui: jobs.length },
    applications: { seeded: dbIds.applications.length, exported: exportedApps.length, ui: apps.length },
    resumeRevisions: { seeded: dbIds.revisions.length, exported: exportedRevisions.length },
    communications: { seeded: dbIds.communications.length, exported: exportedComms.length },
    linkedin: { seeded: dbIds.linkedin.length, exported: exportedLinkedin.length, ui: posts.length },
    roadmaps: { seeded: dbIds.roadmaps.length, exported: exportedRoadmaps.length },
    weeklyReviews: { seeded: dbIds.reviews.length, exported: exportedReviews.length, ui: weekly.history.length },
    memories: { seeded: dbIds.memories.length, exported: exportedMemories.length, ui: mem.memories.length },
    graph: { entities: exportedEntities.length, relations: exportedRelations.length },
    nestedEvents: { seeded: dbIds.events.length, exported: exportedAppEvents.length, hosted: hostedEvents.length },
    exceedsUiJobs: exportedJobs.length > jobs.length,
    exceedsUiMemory: exportedMemories.length > mem.memories.length,
  };

  assert(exportedJobs.length === dbIds.jobs.length, "Export includes all jobs.");
  assert(exportedJobs.length > 20, "Export jobs exceed the UI take limit.");
  assert(exportedApps.length === dbIds.applications.length, "Export includes all applications.");
  assert(exportedRevisions.length === dbIds.revisions.length, "Export includes all resume revisions.");
  assert(exportedComms.length === dbIds.communications.length, "Export includes all communications.");
  assert(exportedLinkedin.length === dbIds.linkedin.length, "Export includes all LinkedIn posts.");
  assert(exportedRoadmaps.length === dbIds.roadmaps.length, "Export includes all roadmaps.");
  assert(exportedReviews.length === dbIds.reviews.length, "Export includes all weekly reviews.");
  assert(exportedMemories.length === dbIds.memories.length, "Export includes all memories.");
  assert(exportedMemories.length > 80, "Export memories exceed the UI take limit.");
  assert(hostedEvents.length === 25, "Nested application events are complete beyond the old take: 20.");
  assert(exportedAppEvents.length === dbIds.events.length, "All application events are exported.");
  assert(dbIds.jobs.every((id) => idsOf(exportedJobs).includes(id)), "No skipped jobs.");
  assert(dbIds.applications.every((id) => idsOf(exportedApps).includes(id)), "No skipped applications.");
  assert(dbIds.memories.every((id) => idsOf(exportedMemories).includes(id)), "No skipped memories.");
  assert(uniqueIds(idsOf(exportedJobs)), "No duplicate exported jobs.");
  assert(uniqueIds(idsOf(exportedApps)), "No duplicate exported applications.");
  assert(uniqueIds(idsOf(exportedMemories)), "No duplicate exported memories.");
  assert(uniqueIds(idsOf(exportedAppEvents)), "No duplicate exported events.");

  const completeSerialized = JSON.stringify(completeExport).toLowerCase();
  assert(!completeSerialized.includes("encryptedaccesstoken"), "Complete export still excludes encrypted tokens.");
  assert(!completeSerialized.includes("password"), "Complete export still excludes passwords.");

  const migrations = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    "SELECT COUNT(*)::bigint AS count FROM _prisma_migrations",
  );
  evidence.migrationCount = Number(migrations[0]?.count ?? 0);
  assert(evidence.migrationCount === 20, "Still 20 Prisma migrations.");

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
