import { getCurrentResumeAnalysis } from "@/features/resume/provenance/resolvers";
import { prisma } from "@/server/db/prisma";

export async function getInsightSourceTimestampsForUser(userId: string): Promise<{
  latestResumeAt: string | null;
  latestJobAt: string | null;
  currentJobCount: number;
}> {
  const [currentResume, latestJob, jobCount] = await Promise.all([
    getCurrentResumeAnalysis(userId),
    prisma.jobPosting.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, createdAt: true },
    }),
    prisma.jobPosting.count({ where: { userId } }),
  ]);

  return {
    latestResumeAt: currentResume?.createdAt.toISOString() ?? null,
    latestJobAt: latestJob
      ? (latestJob.updatedAt ?? latestJob.createdAt).toISOString()
      : null,
    currentJobCount: jobCount,
  };
}
