import { getLatestResumeAnalysisForUser } from "@/features/resume/server";

import { generateSkillsOverview } from "./generate-skills-overview";
import { getJobSkillsSnapshotsForUser } from "./get-job-skills-snapshots-for-user";
import { getLatestSkillsInsightForUser } from "./get-latest-skills-insight-for-user";
import { mapSkillsInsightToView } from "./map-skills-insight-to-view";
import type { SkillsModuleData, WorkspaceSkillsStatus } from "../types";

export async function getSkillsModuleDataForUser(
  userId: string,
): Promise<SkillsModuleData> {
  const [resume, jobs, latestInsight] = await Promise.all([
    getLatestResumeAnalysisForUser(userId),
    getJobSkillsSnapshotsForUser(userId),
    getLatestSkillsInsightForUser(userId),
  ]);

  if (!resume) {
    return {
      hasResume: false,
      resumeRole: null,
      resumeExperienceLevel: null,
      overview: null,
      insight: null,
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
    insight: latestInsight ? mapSkillsInsightToView(latestInsight) : null,
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
