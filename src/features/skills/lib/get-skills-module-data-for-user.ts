import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { getTargetJobContextForUser } from "@/features/jobs/server";
import { evaluateInsightFreshness } from "@/features/shared/insights/freshness";
import { getInsightSourceTimestampsForUser } from "@/features/shared/insights/get-insight-source-timestamps";

import { buildSelectedJobSkillContext } from "./build-selected-job-skill-context";
import { getJobSkillsSnapshotsForUser } from "./get-job-skills-snapshots-for-user";
import { getLatestSkillsInsightForUser } from "./get-latest-skills-insight-for-user";
import { mapSkillsInsightToView } from "./map-skills-insight-to-view";
import type { SkillsModuleData, WorkspaceSkillsStatus } from "../types";

const CALM_STALE_REASON =
  "Saved jobs changed since this strategy was generated. Refresh to update all-jobs recommendations.";

export async function getSkillsModuleDataForUser(
  userId: string,
  requestedJobId?: string | null,
): Promise<SkillsModuleData> {
  const [resume, targetJobContext, allJobSnapshots, latestInsight, sourceTimestamps] = await Promise.all([
    getLatestResumeAnalysisForUser(userId),
    getTargetJobContextForUser(userId, requestedJobId),
    getJobSkillsSnapshotsForUser(userId),
    getLatestSkillsInsightForUser(userId),
    getInsightSourceTimestampsForUser(userId),
  ]);

  const selectedMode = targetJobContext.mode === "selected_job";

  if (!resume) {
    return {
      hasResume: false,
      resumeRole: null,
      resumeExperienceLevel: null,
      overview: null,
      insight: null,
      targetJobContext,
      scopeMode: selectedMode ? "selected_job" : "all_jobs",
    };
  }

  const skillContext = buildSelectedJobSkillContext({
    resume,
    targetJobContext,
    allJobSnapshots,
    mode: selectedMode ? "selected" : "all_jobs",
  });
  const overview = skillContext.overview;

  const currentJobCount = sourceTimestamps.currentJobCount;

  // Persisted AI strategy is all-jobs only. In selected-job mode it is secondary.
  let insight =
    currentJobCount > 0 && latestInsight
      ? mapSkillsInsightToView(latestInsight, {
          isStale: false,
          staleReason: null,
        })
      : null;

  if (insight && latestInsight) {
    const freshness = evaluateInsightFreshness({
      generatedAt: latestInsight.createdAt,
      latestResumeAt: sourceTimestamps.latestResumeAt,
      latestJobAt: sourceTimestamps.latestJobAt,
      currentJobCount,
      insightJobCount: latestInsight.jobCount,
    });

    insight = {
      ...insight,
      isStale: freshness.isStale,
      staleReason: freshness.isStale
        ? selectedMode
          ? "All-jobs strategy may need refresh. Selected-job guidance below uses the selected job."
          : CALM_STALE_REASON
        : null,
    };
  }

  return {
    hasResume: true,
    resumeRole: resume.role,
    resumeExperienceLevel: resume.experienceLevel,
    overview,
    insight,
    targetJobContext,
    scopeMode: selectedMode ? "selected_job" : "all_jobs",
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
