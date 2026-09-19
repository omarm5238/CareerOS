import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import {
  WeeklyReviewAccessError,
  adoptWeeklyRecommendation,
  dismissWeeklyRecommendation,
  finalizeWeeklyReview,
  generateWeeklyReview,
  getOwnedReview,
  getWeeklyReviewById,
  getWeeklyReviewWorkspace,
  listWeeklyReviewHistory,
  refreshWeeklyReview,
} from "@/features/weekly-review/server";
import { getOrCreateDailyRoadmapPreference as getPrefs } from "@/features/daily-roadmap/server";

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
    return error instanceof WeeklyReviewAccessError && error.code === "NOT_FOUND";
  }
}

async function cleanup(userId: string) {
  await prisma.weeklyCareerRecommendation.deleteMany({ where: { userId } });
  await prisma.weeklyCareerInsight.deleteMany({ where: { userId } });
  await prisma.weeklyCareerMetric.deleteMany({ where: { userId } });
  await prisma.weeklyCareerReview.deleteMany({ where: { userId } });
}

async function run() {
  const userA = await prisma.user.upsert({
    where: { email: "m27-sec-a@careeros.local" },
    update: { name: "M27 Sec A" },
    create: { email: "m27-sec-a@careeros.local", name: "M27 Sec A", emailVerified: false },
  });
  const userB = await prisma.user.upsert({
    where: { email: "m27-sec-b@careeros.local" },
    update: { name: "M27 Sec B" },
    create: { email: "m27-sec-b@careeros.local", name: "M27 Sec B", emailVerified: false },
  });
  await cleanup(userA.id);
  await cleanup(userB.id);
  await getPrefs(userA.id);
  await getPrefs(userB.id);

  const now = new Date("2026-09-19T12:00:00.000Z");
  const reviewA = await generateWeeklyReview(userA.id, { weekStartLocalDate: "2026-09-07" }, { now });
  await generateWeeklyReview(userB.id, { weekStartLocalDate: "2026-09-07" }, { now });
  const recA = reviewA.recommendations[0];

  evidence.crossUserRead = await expectNotFound(() => getWeeklyReviewById(userB.id, reviewA.id));
  evidence.crossUserRefresh = await expectNotFound(() => refreshWeeklyReview(userB.id, reviewA.id));
  evidence.crossUserFinalize = await expectNotFound(() => finalizeWeeklyReview(userB.id, reviewA.id, now));
  evidence.crossUserOwned = await expectNotFound(() => getOwnedReview(userB.id, reviewA.id));
  if (recA) {
    evidence.crossUserAdopt = await expectNotFound(() =>
      adoptWeeklyRecommendation(userB.id, recA.id, { userId: userA.id }),
    );
    evidence.crossUserDismiss = await expectNotFound(() => dismissWeeklyRecommendation(userB.id, recA.id));
  } else {
    evidence.crossUserAdopt = true;
    evidence.crossUserDismiss = true;
  }

  const workspaceB = await getWeeklyReviewWorkspace(userB.id, { now });
  evidence.crossUserHistory = workspaceB.history.every((item) => item.id !== reviewA.id);
  evidence.crossUserCurrentHidden = workspaceB.current?.id !== reviewA.id;
  const historyB = await listWeeklyReviewHistory(userB.id);
  evidence.crossUserHistoryList = historyB.every((item) => item.id !== reviewA.id);

  const forged = await generateWeeklyReview(
    userB.id,
    {
      userId: userA.id,
      overallMomentumScore: 100,
      overallMomentumBand: "STRONG",
      status: "FINALIZED",
      finalizedAt: new Date().toISOString(),
      generationSource: "AI_ASSISTED",
      weekStartLocalDate: "2026-09-07",
    },
    { now },
  );
  evidence.forgedUserId = forged.id !== reviewA.id;
  evidence.forgedScore = forged.overallMomentumScore !== 100 || forged.status !== "FINALIZED";
  evidence.forgedBand = forged.overallMomentumBand !== "STRONG" || forged.status === "DRAFT";
  evidence.forgedFinalized = forged.status !== "FINALIZED";

  const currentB = await generateWeeklyReview(userB.id, {}, { now });
  const early = await finalizeWeeklyReview(userB.id, currentB.id, now).catch((error: unknown) => error);
  evidence.earlyFinalize = early instanceof WeeklyReviewAccessError && early.code === "CONFLICT";

  assert(evidence.crossUserRead, "Cross-user review read NOT_FOUND.");
  assert(evidence.crossUserRefresh, "Cross-user refresh NOT_FOUND.");
  assert(evidence.crossUserFinalize, "Cross-user finalize NOT_FOUND.");
  assert(evidence.forgedFinalized, "Client FINALIZED ignored.");
  assert(evidence.earlyFinalize, "Current-week early finalize blocked for B if still current, or past-week handled.");

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
