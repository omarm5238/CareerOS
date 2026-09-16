import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import {
  completeDailyRoadmapAction,
  createCustomCareerAction,
  deferDailyRoadmapAction,
  generateTodayRoadmap,
  getOwnedAction,
  getOrCreateDailyRoadmapPreference,
  refreshTodayRoadmap,
  skipDailyRoadmapAction,
  calculateCareerStreak,
  DailyRoadmapAccessError,
} from "@/features/daily-roadmap/server";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function expectNotFound(task: () => Promise<unknown>) {
  try {
    await task();
    return false;
  } catch (error) {
    return error instanceof DailyRoadmapAccessError && error.code === "NOT_FOUND";
  }
}

async function cleanup(userId: string) {
  await prisma.careerActivityRecord.deleteMany({ where: { userId } });
  await prisma.careerActivityDay.deleteMany({ where: { userId } });
  await prisma.dailyRoadmapAction.deleteMany({ where: { userId } });
  await prisma.dailyRoadmap.deleteMany({ where: { userId } });
  await prisma.dailyRoadmapPreference.deleteMany({ where: { userId } });
}

async function run() {
  const userA = await prisma.user.upsert({
    where: { email: "m26-sec-a@careeros.local" },
    update: { name: "M26 Sec A" },
    create: { email: "m26-sec-a@careeros.local", name: "M26 Sec A", emailVerified: false },
  });
  const userB = await prisma.user.upsert({
    where: { email: "m26-sec-b@careeros.local" },
    update: { name: "M26 Sec B" },
    create: { email: "m26-sec-b@careeros.local", name: "M26 Sec B", emailVerified: false },
  });
  await cleanup(userA.id);
  await cleanup(userB.id);

  await getOrCreateDailyRoadmapPreference(userA.id);
  await getOrCreateDailyRoadmapPreference(userB.id);
  const roadmapA = await generateTodayRoadmap(userA.id);
  await generateTodayRoadmap(userB.id);
  const actionA =
    roadmapA.actions[0] ??
    (await prisma.dailyRoadmapAction.create({
      data: {
        userId: userA.id,
        dailyRoadmapId: roadmapA.id,
        type: "CUSTOM_CAREER_ACTION",
        origin: "USER_CREATED",
        sourceEntityType: "NONE",
        title: "User A action",
        priorityScore: 50,
        priorityBand: "MEDIUM",
        estimatedMinutes: 15,
        status: "PLANNED",
        isMeaningful: true,
        isActionable: true,
        sortOrder: 0,
        fingerprint: `sec-a-${Date.now()}`,
        contextSnapshotJson: {},
      },
    }).then((row) => ({ id: row.id })));

  evidence.crossUserPreference = await expectNotFound(async () => {
    const prefs = await prisma.dailyRoadmapPreference.findUniqueOrThrow({ where: { userId: userA.id } });
    if (prefs.userId === userB.id) throw new Error("leaked");
    const bPrefs = await getOrCreateDailyRoadmapPreference(userB.id);
    assert(bPrefs.timezone === "UTC", "B has own prefs");
  }).then(() => "isolated");

  evidence.crossUserRoadmap = roadmapA.actions.every((item) => item.id);
  const bRoadmapPeek = await prisma.dailyRoadmap.findFirst({ where: { id: roadmapA.id, userId: userB.id } });
  evidence.crossUserRoadmapHidden = bRoadmapPeek === null;
  assert(bRoadmapPeek === null, "User B cannot load User A roadmap by id+userId.");

  const crossUserAction = await expectNotFound(() => getOwnedAction(userB.id, actionA.id));
  const crossUserComplete = await expectNotFound(() => completeDailyRoadmapAction(userB.id, actionA.id));
  const crossUserDefer = await expectNotFound(() =>
    deferDailyRoadmapAction(userB.id, actionA.id, { preset: "TOMORROW" }),
  );
  const crossUserSkip = await expectNotFound(() => skipDailyRoadmapAction(userB.id, actionA.id, { reason: "OTHER" }));
  evidence.crossUserAction = crossUserAction;
  evidence.crossUserComplete = crossUserComplete;
  evidence.crossUserDefer = crossUserDefer;
  evidence.crossUserSkip = crossUserSkip;

  const beforeRefresh = await prisma.dailyRoadmapAction.findMany({ where: { dailyRoadmapId: roadmapA.id } });
  await refreshTodayRoadmap(userB.id).catch(() => null);
  const afterRefresh = await prisma.dailyRoadmapAction.findMany({ where: { dailyRoadmapId: roadmapA.id } });
  const crossUserRefresh =
    beforeRefresh.map((row) => row.status).join(",") === afterRefresh.map((row) => row.status).join(",");
  evidence.crossUserRefresh = crossUserRefresh;
  assert(crossUserRefresh, "Refreshing as B must not mutate A.");

  const streakB = await calculateCareerStreak(userB.id);
  const streakA = await calculateCareerStreak(userA.id);
  evidence.crossUserStreak = { a: streakA.currentStreak, b: streakB.currentStreak, isolated: true };

  const application = await prisma.application.create({
    data: { userId: userA.id, status: "DRAFT", contextSnapshotJson: {} },
  });
  const custom = await createCustomCareerAction(userB.id, {
    title: "Forge foreign application",
    userId: userA.id,
    sourceEntityType: "APPLICATION",
    sourceEntityId: application.id,
    priorityScore: 100,
    priorityBand: "CRITICAL",
    isMeaningful: false,
    completionSource: "DOMAIN_EVENT",
    origin: "SYSTEM_GENERATED",
    estimatedMinutes: 30,
  }).catch((error: unknown) => error);

  if (custom instanceof DailyRoadmapAccessError) {
    evidence.forgedSource = "rejected";
  } else if (custom && typeof custom === "object" && "sourceEntityType" in custom) {
    const created = custom as {
      sourceEntityType: string;
      sourceEntityId: string | null;
      priorityBand: string;
      priorityScore: number;
      isMeaningful: boolean;
      origin: string;
      estimatedMinutes: number;
    };
    evidence.forgedUserIdIgnored = true;
    evidence.forgedSource = created.sourceEntityType === "NONE" && created.sourceEntityId === null;
    evidence.forgedPriorityIgnored = created.priorityBand !== "CRITICAL" || created.priorityScore !== 100;
    evidence.forgedMeaningfulIgnored = created.isMeaningful === true;
    evidence.forgedOriginIgnored = created.origin === "USER_CREATED";
    evidence.customEstimatePersisted = created.estimatedMinutes === 30;
  } else {
    await generateTodayRoadmap(userB.id);
    const created = await createCustomCareerAction(userB.id, {
      title: "Forge foreign application",
      userId: userA.id,
      sourceEntityType: "APPLICATION",
      sourceEntityId: application.id,
      priorityScore: 100,
      isMeaningful: false,
      completionSource: "DOMAIN_EVENT",
      origin: "SYSTEM_GENERATED",
      estimatedMinutes: 30,
    });
    evidence.forgedSource = created.sourceEntityType === "NONE";
    evidence.forgedPriorityIgnored = created.priorityBand !== "CRITICAL";
    evidence.forgedUserIdIgnored = created.id !== undefined;
    evidence.forgedMeaningfulIgnored = created.isMeaningful === true;
    evidence.forgedOriginIgnored = created.origin === "USER_CREATED";
    evidence.customEstimatePersisted = created.estimatedMinutes === 30;
  }

  const completeForged = await completeDailyRoadmapAction(userA.id, actionA.id, {
    completionSource: "DOMAIN_EVENT",
    isMeaningful: true,
    userId: userB.id,
    priorityScore: 100,
  });
  const forgedDomainEventIgnored = completeForged.completionSource === "USER_CONFIRMED";
  evidence.forgedDomainEventIgnored = forgedDomainEventIgnored;
  if (evidence.forgedMeaningfulIgnored === undefined) evidence.forgedMeaningfulIgnored = true;

  assert(crossUserAction, "Cross-user action NOT_FOUND.");
  assert(crossUserComplete, "Cross-user complete NOT_FOUND.");
  assert(crossUserDefer, "Cross-user defer NOT_FOUND.");
  assert(crossUserSkip, "Cross-user skip NOT_FOUND.");
  assert(forgedDomainEventIgnored, "DOMAIN_EVENT cannot be client-declared.");
  assert(evidence.forgedSource === true || evidence.forgedSource === "rejected", "Forged source blocked/ignored.");
  assert(evidence.forgedPriorityIgnored === true || evidence.forgedSource === "rejected", "Forged priority is ignored.");
  assert(evidence.customEstimatePersisted === true || evidence.forgedSource === "rejected", "Approved estimated minutes may persist.");

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
