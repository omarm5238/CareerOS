import { prisma } from "@/server/db/prisma";

export async function dismissDiscoveredJob(
  userId: string,
  discoveredJobId: string,
  reason?: string,
): Promise<boolean> {
  const job = await prisma.discoveredJob.findFirst({
    where: { id: discoveredJobId, userId },
    select: { id: true },
  });

  if (!job) return false;

  await prisma.discoveredJob.update({
    where: { id: job.id },
    data: {
      discoveryStatus: "DISMISSED",
      dismissedAt: new Date(),
      dismissedReason: reason?.slice(0, 200) ?? null,
    },
  });

  return true;
}
