import { prisma } from "@/server/db/prisma";

export async function deleteJobPostingForUser(
  userId: string,
  jobId: string,
): Promise<boolean> {
  const existing = await prisma.jobPosting.findFirst({
    where: { id: jobId, userId },
    select: { id: true },
  });

  if (!existing) return false;

  await prisma.jobPosting.delete({
    where: { id: existing.id },
  });

  // If this was the last saved job, generated skills strategies no longer
  // have market data behind them — clear them so they are not shown as current.
  const remainingJobs = await prisma.jobPosting.count({ where: { userId } });
  if (remainingJobs === 0) {
    await prisma.skillsInsight.deleteMany({ where: { userId } });
  }

  return true;
}
