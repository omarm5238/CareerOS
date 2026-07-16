import { prisma } from "@/server/db/prisma";

import type { SkillsJobAnalysisInput } from "../ai/types";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function getJobAnalysisInputsForSkills(
  userId: string,
  limit = 10,
): Promise<SkillsJobAnalysisInput[]> {
  const jobs = await prisma.jobPosting.findMany({
    where: {
      userId,
      analysis: { isNot: null },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { analysis: true },
  });

  return jobs
    .filter((job) => job.analysis !== null)
    .map((job) => ({
      title: job.title,
      company: job.company,
      matchScore: job.analysis!.matchScore,
      roleAlignment: job.analysis!.roleAlignment,
      matchedSkills: parseStringArray(job.analysis!.matchedSkills),
      missingSkills: parseStringArray(job.analysis!.missingSkills),
      jobSignals: parseStringArray(job.analysis!.jobSignals),
      fitSummary: job.analysis!.fitSummary ?? null,
      resumeTailoringTips: parseStringArray(job.analysis!.resumeTailoringTips),
    }));
}
