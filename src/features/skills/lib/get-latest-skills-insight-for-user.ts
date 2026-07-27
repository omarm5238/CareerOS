import { prisma } from "@/server/db/prisma";

export async function getLatestSkillsInsightForUser(userId: string) {
  const [latest, latestAi] = await Promise.all([
    prisma.skillsInsight.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.skillsInsight.findFirst({
      where: { userId, analysisSource: "ai" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return latestAi ?? latest;
}
