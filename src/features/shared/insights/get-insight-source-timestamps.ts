import { prisma } from "@/server/db/prisma";

export async function getInsightSourceTimestampsForUser(userId: string): Promise<{
  latestResumeAt: string | null;
  latestJobAt: string | null;
  currentJobCount: number;
}> {
  const [latestResume, latestJob, jobCount] = await Promise.all([
    prisma.resumeDocument.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, createdAt: true },
    }),
    prisma.jobPosting.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, createdAt: true },
    }),
    prisma.jobPosting.count({ where: { userId } }),
  ]);

  return {
    latestResumeAt: latestResume
      ? (latestResume.updatedAt ?? latestResume.createdAt).toISOString()
      : null,
    latestJobAt: latestJob
      ? (latestJob.updatedAt ?? latestJob.createdAt).toISOString()
      : null,
    currentJobCount: jobCount,
  };
}
