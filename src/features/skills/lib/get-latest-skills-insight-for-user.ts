import { prisma } from "@/server/db/prisma";

export async function getLatestSkillsInsightForUser(userId: string) {
  return prisma.skillsInsight.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}
