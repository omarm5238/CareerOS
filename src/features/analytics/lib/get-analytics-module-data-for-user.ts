import { parseApplicationStatus } from "@/features/jobs/constants/application-status";
import { getJobPostingsForUser } from "@/features/jobs/server";
import {
  getLatestResumeAnalysisForUser,
  getResumeAnalysisHistoryForUser,
} from "@/features/resume/server";
import { evaluateInsightFreshness } from "@/features/shared/insights/freshness";
import { getInsightSourceTimestampsForUser } from "@/features/shared/insights/get-insight-source-timestamps";
import { buildSelectedTargetDelta } from "@/features/shared/insights";
import type { PrioritySkillItem } from "@/features/skills/types";
import { getSkillsModuleDataForUser } from "@/features/skills/server";

import { generateAnalyticsRecommendations } from "./generate-analytics-recommendations";
import { generateCareerHealthScore } from "./generate-career-health-score";
import { getLatestCareerBriefForUser } from "./get-latest-career-brief-for-user";
import { mapCareerBriefToView } from "./map-career-brief-to-view";
import { buildCareerExecutionPlan } from "./build-career-execution-plan";
import type {
  AnalyticsJobsMetrics,
  AnalyticsModuleData,
  WorkspaceAnalyticsStatus,
} from "../types";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildJobsMetrics(jobs: Awaited<ReturnType<typeof getJobPostingsForUser>>): AnalyticsJobsMetrics {
  const analyzed = jobs.filter((job) => job.analysis !== null);
  const scores = analyzed.map((job) => job.analysis!.matchScore);

  let strongMatchesCount = 0;
  let partialMatchesCount = 0;
  let weakMatchesCount = 0;
  let aiAnalyzedCount = 0;
  let ruleBasedAnalyzedCount = 0;
  let savedStatusCount = 0;
  let appliedStatusCount = 0;
  let interviewStatusCount = 0;
  let offerStatusCount = 0;
  let rejectedStatusCount = 0;

  for (const job of jobs) {
    const status = parseApplicationStatus(job.applicationStatus);
    if (status === "saved") savedStatusCount += 1;
    else if (status === "applied") appliedStatusCount += 1;
    else if (status === "interview") interviewStatusCount += 1;
    else if (status === "offer") offerStatusCount += 1;
    else if (status === "rejected") rejectedStatusCount += 1;
  }

  for (const job of analyzed) {
    const alignment = job.analysis!.roleAlignment;
    if (alignment === "Strong") {
      strongMatchesCount += 1;
    } else if (alignment === "Partial" || alignment === "Unknown") {
      partialMatchesCount += 1;
    } else {
      weakMatchesCount += 1;
    }

    if (job.analysis!.analysisSource === "ai") {
      aiAnalyzedCount += 1;
    } else {
      ruleBasedAnalyzedCount += 1;
    }
  }

  return {
    savedJobsCount: jobs.length,
    averageMatchScore: average(scores),
    bestMatchScore: scores.length > 0 ? Math.max(...scores) : null,
    weakestMatchScore: scores.length > 0 ? Math.min(...scores) : null,
    strongMatchesCount,
    partialMatchesCount,
    weakMatchesCount,
    aiAnalyzedCount,
    ruleBasedAnalyzedCount,
    savedStatusCount,
    appliedStatusCount,
    interviewStatusCount,
    offerStatusCount,
    rejectedStatusCount,
  };
}

export async function getAnalyticsModuleDataForUser(
  userId: string,
  requestedJobId?: string | null,
): Promise<AnalyticsModuleData> {
  const [resume, history, jobs, skillsData, latestBrief, sourceTimestamps] = await Promise.all([
    getLatestResumeAnalysisForUser(userId),
    getResumeAnalysisHistoryForUser(userId),
    getJobPostingsForUser(userId),
    getSkillsModuleDataForUser(userId, requestedJobId),
    getLatestCareerBriefForUser(userId),
    getInsightSourceTimestampsForUser(userId),
  ]);

  const jobsMetrics = buildJobsMetrics(jobs);
  const skillsOverview = skillsData.overview;

  const resumeMetrics = {
    hasResume: !!resume,
    latestRole: resume?.role ?? null,
    latestExperienceLevel: resume?.experienceLevel ?? null,
    completenessScore: resume?.completenessScore ?? null,
    resumeAnalysesCount: history.length,
    detectedSkillsCount: resume?.detectedSkills.length ?? 0,
    analysisSource: resume?.analysisSource ?? null,
  };

  const prioritySkills: PrioritySkillItem[] = skillsOverview?.prioritySkills ?? [];
  const skillsMetrics = {
    detectedSkillsCount: skillsOverview?.detectedSkills.length ?? resumeMetrics.detectedSkillsCount,
    skillCoverageScore: skillsOverview?.skillCoverageScore ?? null,
    prioritySkillsCount: prioritySkills.length,
    gapsCount: skillsOverview?.missingSkillsFromJobs.length ?? 0,
    topPrioritySkills: prioritySkills
      .slice(0, 5)
      .map((item: PrioritySkillItem) => item.skill)
      .filter((skill): skill is string => Boolean(skill)),
    skillsInsightSource: skillsData.insight?.analysisSource ?? null,
    skillsInsightGeneratedAt: skillsData.insight?.generatedAt ?? null,
  };

  const careerHealth = generateCareerHealthScore({
    hasResume: resumeMetrics.hasResume,
    completenessScore: resumeMetrics.completenessScore,
    skillCoverageScore: skillsMetrics.skillCoverageScore,
    savedJobsCount: jobsMetrics.savedJobsCount,
    averageMatchScore:
      skillsData.scopeMode === "selected_job"
        ? skillsData.targetJobContext.selectedJob?.analysis?.matchScore ?? null
        : jobsMetrics.averageMatchScore,
  });

  const hasUsableData =
    resumeMetrics.hasResume ||
    jobsMetrics.savedJobsCount > 0 ||
    resumeMetrics.resumeAnalysesCount > 0;

  const recommendations = generateAnalyticsRecommendations({
    resume: resumeMetrics,
    jobs: jobsMetrics,
    skills: skillsMetrics,
  });
  const liveExecutionPlan = buildCareerExecutionPlan({
    hasResume: !!resume,
    resumeFixes: [
      ...(resume?.weaknesses ?? []),
      ...(resume?.suggestedFocus ?? []),
    ].slice(0, 6),
    skillGaps: skillsOverview?.missingSkillsFromJobs.slice(0, 4) ?? [],
    projectIdeas: skillsOverview?.projectIdeas.map((item) => item.title) ?? [],
    savedJobsCount: skillsData.targetJobContext.savedJobsCount,
    appliedCount: jobsMetrics.appliedStatusCount,
    selectedJobTitle:
      skillsData.scopeMode === "selected_job"
        ? skillsData.targetJobContext.selectedJobTitle
        : null,
    selectedJobCompany:
      skillsData.scopeMode === "selected_job"
        ? skillsData.targetJobContext.selectedJobCompany
        : null,
  });

  const briefFreshness = latestBrief
    ? evaluateInsightFreshness({
        generatedAt: latestBrief.createdAt,
        latestResumeAt: sourceTimestamps.latestResumeAt,
        latestJobAt: sourceTimestamps.latestJobAt,
        currentJobCount: sourceTimestamps.currentJobCount,
      })
    : null;

  const selectedJobTitle =
    skillsData.scopeMode === "selected_job"
      ? skillsData.targetJobContext.selectedJobTitle
      : null;
  const selectedJob = skillsData.targetJobContext.selectedJob;
  const selectedTargetDelta =
    skillsData.scopeMode === "selected_job" && selectedJob
      ? buildSelectedTargetDelta({
          jobTitle: selectedJob.title,
          company: selectedJob.company,
          matchScore: selectedJob.analysis?.matchScore,
          missingTechnicalSkills: skillsOverview?.missingSkillsFromJobs ?? [],
          experienceGaps: skillsOverview?.experienceGaps,
          evidenceGaps: skillsOverview?.evidenceGaps,
          contextRequirements: skillsOverview?.contextRequirements,
        })
      : null;

  return {
    careerHealth: {
      ...careerHealth,
      explanation: selectedJobTitle
        ? `${careerHealth.explanation} Scoped to selected target job: ${selectedJobTitle}.`
        : careerHealth.explanation,
    },
    resume: resumeMetrics,
    jobs: jobsMetrics,
    skills: skillsMetrics,
    recommendations,
    hasUsableData,
    careerBrief: latestBrief
      ? mapCareerBriefToView(latestBrief, {
          isStale: briefFreshness?.isStale ?? false,
          staleReason: briefFreshness?.isStale
            ? "Needs refresh. Resume or saved-job data changed since this brief was generated."
            : null,
        })
      : null,
    liveExecutionPlan,
    targetJobContext: skillsData.targetJobContext,
    scopeMode: skillsData.scopeMode,
    selectedTargetDelta,
  };
}

export async function getWorkspaceAnalyticsStatusForUser(
  userId: string,
): Promise<WorkspaceAnalyticsStatus> {
  const data = await getAnalyticsModuleDataForUser(userId);

  if (!data.hasUsableData) {
    return {
      careerHealthScore: null,
      careerHealthLabel: null,
      hasUsableData: false,
    };
  }

  return {
    careerHealthScore: data.careerHealth.score,
    careerHealthLabel: data.careerHealth.label,
    hasUsableData: true,
  };
}
