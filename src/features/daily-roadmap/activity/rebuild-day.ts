import { prisma } from "@/server/db/prisma";

export async function rebuildCareerActivityDay(
  userId: string,
  localDate: string,
  timezone: string,
) {
  const records = await prisma.careerActivityRecord.findMany({
    where: { userId, localDate, meaningful: true },
    orderBy: { occurredAt: "asc" },
  });

  const roadmap = await prisma.dailyRoadmap.findUnique({
    where: { userId_localDate: { userId, localDate } },
    include: { actions: true },
  });

  const plannedActionCount = roadmap
    ? roadmap.actions.filter((action) =>
        action.status === "PLANNED" ||
        action.status === "IN_PROGRESS" ||
        action.status === "COMPLETED" ||
        action.status === "BLOCKED",
      ).length
    : 0;
  const completedActionCount = roadmap
    ? roadmap.actions.filter((action) => action.status === "COMPLETED").length
    : 0;
  const completedMinutes = roadmap
    ? roadmap.actions
        .filter((action) => action.status === "COMPLETED")
        .reduce((sum, action) => sum + action.estimatedMinutes, 0)
    : records.reduce((sum, record) => sum + (record.minutes ?? 0), 0);

  const first = records[0]?.occurredAt ?? null;
  const last = records.at(-1)?.occurredAt ?? null;

  return prisma.careerActivityDay.upsert({
    where: { userId_localDate: { userId, localDate } },
    create: {
      userId,
      localDate,
      timezone,
      meaningfulActionCount: records.length,
      completedActionCount,
      plannedActionCount,
      completedMinutes,
      qualifiesForStreak: records.length > 0,
      firstMeaningfulActivityAt: first,
      lastMeaningfulActivityAt: last,
    },
    update: {
      timezone,
      meaningfulActionCount: records.length,
      completedActionCount,
      plannedActionCount,
      completedMinutes,
      qualifiesForStreak: records.length > 0,
      firstMeaningfulActivityAt: first,
      lastMeaningfulActivityAt: last,
    },
  });
}
