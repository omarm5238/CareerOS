import { parseApplicationStatus } from "@/features/jobs/constants/application-status";
import { getJobPostingsForUser } from "@/features/jobs/server";
import {
  getLatestResumeAnalysisForUser,
  getResumeAnalysisHistoryForUser,
} from "@/features/resume/server";
import { getSkillsModuleDataForUser } from "@/features/skills/server";

import { generateAnalyticsRecommendations } from "./generate-analytics-recommendations";
import { generateCareerHealthScore } from "./generate-career-health-score";
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
): Promise<AnalyticsModuleData> {
  const [resume, history, jobs, skillsData] = await Promise.all([
    getLatestResumeAnalysisForUser(userId),
    getResumeAnalysisHistoryForUser(userId),
    getJobPostingsForUser(userId),
    getSkillsModuleDataForUser(userId),
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

  const skillsMetrics = {
    detectedSkillsCount: skillsOverview?.detectedSkills.length ?? resumeMetrics.detectedSkillsCount,
    skillCoverageScore: skillsOverview?.skillCoverageScore ?? null,
    prioritySkillsCount: skillsOverview?.prioritySkills.length ?? 0,
    gapsCount: skillsOverview?.missingSkillsFromJobs.length ?? 0,
    topPrioritySkills: (skillsOverview?.prioritySkills ?? [])
      .slice(0, 5)
      .map((item) => item.skill),
    skillsInsightSource: skillsData.insight?.analysisSource ?? null,
    skillsInsightGeneratedAt: skillsData.insight?.generatedAt ?? null,
  };

  const careerHealth = generateCareerHealthScore({
    hasResume: resumeMetrics.hasResume,
    completenessScore: resumeMetrics.completenessScore,
    skillCoverageScore: skillsMetrics.skillCoverageScore,
    savedJobsCount: jobsMetrics.savedJobsCount,
    averageMatchScore: jobsMetrics.averageMatchScore,
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

  return {
    careerHealth,
    resume: resumeMetrics,
    jobs: jobsMetrics,
    skills: skillsMetrics,
    recommendations,
    hasUsableData,
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
