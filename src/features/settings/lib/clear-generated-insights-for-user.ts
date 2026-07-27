import { prisma } from "@/server/db/prisma";

export type ClearGeneratedInsightsResult = {
  skillsInsightsDeleted: number;
  careerBriefsDeleted: number;
};

export async function clearGeneratedInsightsForUser(
  userId: string,
): Promise<ClearGeneratedInsightsResult> {
  const [skillsResult, briefsResult] = await Promise.all([
    prisma.skillsInsight.deleteMany({ where: { userId } }),
    prisma.careerBrief.deleteMany({ where: { userId } }),
  ]);

  return {
    skillsInsightsDeleted: skillsResult.count,
    careerBriefsDeleted: briefsResult.count,
  };
}
