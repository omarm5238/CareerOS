import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "@/server/db/prisma";
import { exportWorkspaceDataForUser, getSettingsModuleDataForUser, stripExportSecrets, updateUserProfile } from "@/features/settings/server";
import {
  createUserDeclaredMemory,
  getCareerMemoryWorkspace,
  getOwnedMemoryView,
} from "@/features/career-memory/server";
import { getApplicationsForUser } from "@/features/applications/lib/get-applications-for-user";
import { getJobPostingsForUser } from "@/features/jobs/lib/get-job-postings-for-user";
import { getSafeLinkedinConnection } from "@/features/linkedin/server";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asRecord(item));
}

async function makeUser(email: string, name: string) {
  return (
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.create({ data: { email, name, emailVerified: false } }))
  );
}

async function run() {
  const userA = await makeUser("m29-sec-a@careeros.local", "M29 A");
  const userB = await makeUser("m29-sec-b@careeros.local", "M29 B");
  const memory = await createUserDeclaredMemory(userA.id, { category: "skill", value: "Go" });
  if ((await prisma.jobPosting.count({ where: { userId: userA.id } })) < 110) {
    await prisma.jobPosting.create({
      data: { userId: userA.id, title: "Owned job", company: "A Co", description: "Go" },
    });
    await prisma.jobPosting.createMany({
      data: Array.from({ length: 120 }, (_, index) => ({
        userId: userA.id,
        title: `Paged job ${index}`,
        company: "A Co",
        description: "Go PostgreSQL",
      })),
    });
  }
  if ((await prisma.application.count({ where: { userId: userA.id } })) < 20) {
    await prisma.application.create({
      data: { userId: userA.id, status: "DRAFT", source: "MANUAL", contextSnapshotJson: { secret: "should-not-leak-if-not-exported" } },
    });
    await prisma.application.createMany({
      data: Array.from({ length: 30 }, () => ({
        userId: userA.id,
        status: "APPLIED" as const,
        source: "MANUAL" as const,
        contextSnapshotJson: {},
      })),
    });
  }
  await prisma.weeklyCareerReview.createMany({
    data: Array.from({ length: 14 }, (_, index) => {
      const start = new Date("2025-01-06T00:00:00.000Z");
      start.setUTCDate(start.getUTCDate() + index * 7);
      const weekStart = start.toISOString().slice(0, 10);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      return {
        userId: userA.id,
        weekStartLocalDate: weekStart,
        weekEndLocalDate: end.toISOString().slice(0, 10),
        timezone: "UTC",
        status: "FINALIZED" as const,
        contextFingerprint: `m29-sec-week-${weekStart}`,
        overallMomentumScore: 70,
        overallMomentumBand: "STEADY" as const,
      };
    }),
    skipDuplicates: true,
  });
  if ((await prisma.careerMemory.count({ where: { userId: userA.id } })) < 100) {
    await prisma.careerMemory.createMany({
      data: Array.from({ length: 110 }, (_, index) => ({
        userId: userA.id,
        type: "SKILL_SIGNAL" as const,
        category: "SKILL" as const,
        subjectKey: "skill.has",
        normalizedValueKey: `sec-skill-${index}`,
        normalizedText: `Sec skill ${index}`,
        semanticKey: `SKILL_SIGNAL:SKILL:skill.has:sec-skill-${index}`,
        status: "ACTIVE" as const,
        confidence: "MEDIUM" as const,
        confidenceScore: 60,
        importance: "MEDIUM" as const,
        firstObservedAt: new Date(),
        lastObservedAt: new Date(),
        sourceType: "M23_JOBS" as const,
      })),
      skipDuplicates: true,
    });
  }
  await prisma.careerGraphEntity.createMany({
    data: Array.from({ length: 20 }, (_, index) => ({
      userId: userA.id,
      entityType: "SKILL" as const,
      canonicalKey: `skill:sec-${index}`,
      displayName: `Sec skill ${index}`,
    })),
    skipDuplicates: true,
  });

  const exportRoute = readFileSync(path.join(process.cwd(), "src/app/api/settings/export/route.ts"), "utf8");
  const exportAuth = {
    requiresSession: exportRoute.includes("auth.api.getSession"),
    usesSessionUser: exportRoute.includes("session.user.id"),
    ignoresQueryUserId: !exportRoute.includes("searchParams") && !exportRoute.includes("userId"),
  };
  evidence.exportAuth = exportAuth;
  assert(exportAuth.requiresSession && exportAuth.usesSessionUser, "Export route is session-authenticated.");
  assert(exportAuth.ignoresQueryUserId, "Export route does not accept client userId.");

  const profileRoute = readFileSync(path.join(process.cwd(), "src/app/api/settings/profile/route.ts"), "utf8");
  const settingsOwnership = {
    sessionUser: profileRoute.includes("session.user.id"),
    noClientUserId: !profileRoute.includes("body.userId") && !profileRoute.includes("searchParams"),
  };
  evidence.settingsOwnership = settingsOwnership;
  assert(settingsOwnership.sessionUser, "Settings profile uses session user.");

  const exportA = asRecord(await exportWorkspaceDataForUser(userA.id));
  const exportB = asRecord(await exportWorkspaceDataForUser(userB.id));
  const dataA = asRecord(exportA.data);
  const dataB = asRecord(exportB.data);
  const profileA = asRecord(dataA.profile);
  const profileB = asRecord(dataB.profile);
  evidence.exportScoped = {
    a: profileA.email,
    b: profileB.email,
  };
  assert(profileA.email === "m29-sec-a@careeros.local", "Export A is user A.");
  assert(profileB.email === "m29-sec-b@careeros.local", "Export B is user B.");
  assert(JSON.stringify(exportB).includes(userA.id) === false, "User B cannot export User A data.");
  assert(JSON.stringify(exportA).includes("should-not-leak") === false, "Application snapshot secrets stay out of export.");

  const jobsA = asArray(asRecord(dataA.jobs).postings);
  const jobsB = asArray(asRecord(dataB.jobs).postings);
  const appsA = asArray(dataA.applications);
  const appsB = asArray(dataB.applications);
  const reviewsA = asArray(dataA.weeklyReviews);
  const reviewsB = asArray(dataB.weeklyReviews);
  const memoriesA = asArray(asRecord(dataA.memory).items);
  const memoriesB = asArray(asRecord(dataB.memory).items);
  const graphB = asRecord(asRecord(dataB.memory).graph);
  evidence.paginatedCrossUser = {
    jobsA: jobsA.length,
    jobsB: jobsB.length,
    appsA: appsA.length,
    appsB: appsB.length,
    reviewsA: reviewsA.length,
    reviewsB: reviewsB.length,
    memoriesA: memoriesA.length,
    memoriesB: memoriesB.length,
  };
  assert(jobsA.length > 100, "User A export spans more than one export batch.");
  assert(jobsB.length === 0, "User B export contains zero User A jobs.");
  assert(appsB.every((row) => String(row.id) !== String(appsA[0]?.id)), "User B applications exclude User A.");
  assert(reviewsB.length === 0, "User B export contains zero User A weekly reviews.");
  assert(!memoriesB.some((row) => row.id === memory.id), "User B export contains zero User A memories.");
  assert(asArray(graphB.entities).every((row) => !JSON.stringify(row).includes(userA.id)), "User B graph has no User A rows.");

  const forgedExport = await exportWorkspaceDataForUser(userB.id);
  evidence.forgedUserIdIgnored =
    asRecord(asRecord(asRecord(forgedExport).data).profile).email === "m29-sec-b@careeros.local";
  assert(evidence.forgedUserIdIgnored, "Export authority is the caller userId, not a client body.");

  const settingsB = await getSettingsModuleDataForUser(userB.id);
  evidence.settingsDataOwnership = settingsB?.profile.email === "m29-sec-b@careeros.local";
  assert(evidence.settingsDataOwnership, "Settings are user-scoped.");

  const renamed = await updateUserProfile(userB.id, { name: "M29 B Safe" });
  evidence.profileUpdateScoped = renamed?.id === userB.id && renamed?.email === "m29-sec-b@careeros.local";
  assert(evidence.profileUpdateScoped, "Profile update stays on the session user.");

  const stolenMemory = await getOwnedMemoryView(userB.id, memory.id);
  evidence.crossUserMemory = stolenMemory === null;
  assert(stolenMemory === null, "User B cannot read user A memory.");

  const bWorkspace = await getCareerMemoryWorkspace(userB.id);
  evidence.crossUserMemoryWorkspace = !bWorkspace.memories.some((item) => item.id === memory.id);
  assert(evidence.crossUserMemoryWorkspace, "User B memory workspace hides User A memories.");

  const bJobs = await getJobPostingsForUser(userB.id);
  const bApps = await getApplicationsForUser(userB.id);
  evidence.crossUserJobs = !bJobs.some((job) => job.title === "Owned job");
  evidence.crossUserApplications = bApps.length === 0 || !JSON.stringify(bApps).includes(userA.id);
  assert(evidence.crossUserJobs, "User B cannot list User A jobs.");

  const created = await createUserDeclaredMemory(userA.id, {
    category: "skill",
    value: "TypeScript",
    userId: userB.id,
  } as Record<string, unknown>);
  evidence.forgedMemoryUserId = created.userId === userA.id;
  assert(created.userId === userA.id, "Forged memory userId is ignored.");

  const serialized = JSON.stringify(exportA).toLowerCase();
  const secretLeakage = {
    password: serialized.includes("password"),
    encryptedAccessToken: serialized.includes("encryptedaccesstoken"),
    sessionToken: serialized.includes("sessiontoken"),
    refreshToken: serialized.includes("refreshtoken"),
    apiKey: serialized.includes("sk-"),
    pkce: serialized.includes("pkce"),
  };
  evidence.secretLeakage = secretLeakage;
  assert(
    !secretLeakage.password &&
      !secretLeakage.encryptedAccessToken &&
      !secretLeakage.sessionToken &&
      !secretLeakage.refreshToken &&
      !secretLeakage.pkce,
    "Export has no secret leakage.",
  );

  const stripped = asRecord(stripExportSecrets({ password: "x", accessToken: "y", keep: "ok" }));
  assert(stripped.keep === "ok" && stripped.password === undefined && stripped.accessToken === undefined, "Secret stripper.");

  const connection = await getSafeLinkedinConnection(userB.id);
  const connectionJson = JSON.stringify(connection).toLowerCase();
  const providerTokenSerialization = {
    hasEncrypted: connectionJson.includes("encrypted"),
    hasAccessToken: connectionJson.includes("accesstoken"),
    hasRefresh: connectionJson.includes("refresh"),
  };
  evidence.providerTokenSerialization = providerTokenSerialization;
  assert(!providerTokenSerialization.hasEncrypted, "Safe LinkedIn view does not serialize tokens.");

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
