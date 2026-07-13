import { prisma } from "@/server/db/prisma";
import { getLatestResumeAnalysisForUser } from "@/features/resume/server";

import { generateSkillsOverview } from "./generate-skills-overview";
import type { JobSkillsSnapshot, SkillsModuleData, WorkspaceSkillsStatus } from "../types";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function getJobSkillsSnapshotsForUser(
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

export async function getSkillsModuleDataForUser(
  userId: string,
): Promise<SkillsModuleData> {
  const [resume, jobs] = await Promise.all([
    getLatestResumeAnalysisForUser(userId),
    getJobSkillsSnapshotsForUser(userId),
  ]);

  if (!resume) {
    return {
      hasResume: false,
      resumeRole: null,
      resumeExperienceLevel: null,
      overview: null,
    };
  }

  return {
    hasResume: true,
    resumeRole: resume.role,
    resumeExperienceLevel: resume.experienceLevel,
    overview: generateSkillsOverview({
      resumeDetectedSkills: resume.detectedSkills,
      resumeRole: resume.role,
      resumeExperienceLevel: resume.experienceLevel,
      resumeCompletenessScore: resume.completenessScore,
      resumeSuggestedFocus: resume.suggestedFocus,
      resumeWeaknesses: resume.weaknesses,
      jobs,
    }),
  };
}

export async function getWorkspaceSkillsStatusForUser(
  userId: string,
): Promise<WorkspaceSkillsStatus> {
  const data = await getSkillsModuleDataForUser(userId);

  if (!data.hasResume || !data.overview) {
    return { detectedCount: 0, gapCount: 0, hasResume: false };
  }

  return {
    detectedCount: data.overview.detectedSkills.length,
    gapCount: data.overview.missingSkillsFromJobs.length,
    hasResume: true,
  };
}
