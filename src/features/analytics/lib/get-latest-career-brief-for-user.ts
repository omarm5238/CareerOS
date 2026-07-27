import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

/**
 * Returns the latest Career Brief for a user.
 * Prefer the latest AI brief when one exists; otherwise the latest of any source.
 * Returns null when no brief row exists.
 */
export async function getLatestCareerBriefForUser(userId: string) {
  const careerBrief = (prisma as PrismaClient).careerBrief;

  const [latest, latestAi] = await Promise.all([
    careerBrief.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    careerBrief.findFirst({
      where: { userId, analysisSource: "ai" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return latestAi ?? latest;
}
