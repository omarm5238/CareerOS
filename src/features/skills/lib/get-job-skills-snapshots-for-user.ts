import { prisma } from "@/server/db/prisma";

import type { JobSkillsSnapshot } from "../types";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function getJobSkillsSnapshotsForUser(
  userId: string,
): Promise<JobSkillsSnapshot[]> {
  const jobs = await prisma.jobPosting.findMany({
    where: {
      userId,
      analysis: { isNot: null },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { analysis: true },
  });

  return jobs
    .filter((job) => job.analysis !== null)
    .map((job) => ({
      id: job.id,
      title: job.title,
      matchedSkills: parseStringArray(job.analysis!.matchedSkills),
      missingSkills: parseStringArray(job.analysis!.missingSkills),
      jobSignals: parseStringArray(job.analysis!.jobSignals),
    }));
}
