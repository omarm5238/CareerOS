import { parseApplicationStatus } from "@/features/jobs/constants/application-status";
import type { JobDetailView } from "@/features/jobs";
import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { buildResumeImprovementCenter } from "@/features/resume/lib/build-resume-improvement-center";
import { getSkillsModuleDataForUser } from "@/features/skills/server";

import { resolveCareerBrief } from "../ai";
import type {
  CareerBriefAnalysisInput,
  CareerBriefJobsSummary,
  CareerBriefSkillsInput,
} from "../ai/types";
import type { CareerBriefView } from "../types";
import type { AnalyticsModuleData } from "../types";
import { getAnalyticsModuleDataForUser } from "./get-analytics-module-data-for-user";
import { mapCareerBriefToView } from "./map-career-brief-to-view";
import { saveCareerBrief } from "./save-career-brief";

function buildJobsSummary(
  job: JobDetailView | null,
  analytics: AnalyticsModuleData,
  allJobsMode: boolean,
): CareerBriefJobsSummary {
  if (allJobsMode) {
    return {
      count: analytics.jobs.savedJobsCount,
      bestMatchScore: analytics.jobs.bestMatchScore,
      averageMatchScore: analytics.jobs.averageMatchScore,
      weakestMatchScore: analytics.jobs.weakestMatchScore,
      savedStatusCount: analytics.jobs.savedStatusCount,
      appliedStatusCount: analytics.jobs.appliedStatusCount,
      interviewStatusCount: analytics.jobs.interviewStatusCount,
      offerStatusCount: analytics.jobs.offerStatusCount,
      rejectedStatusCount: analytics.jobs.rejectedStatusCount,
      latestJobs: analytics.targetJobContext.availableJobs
        .filter((item) => item.analysis)
        .slice(0, 5)
        .map((item) => ({
          title: item.title,
          matchScore: item.analysis!.matchScore,
          roleAlignment: item.analysis!.roleAlignment,
          matchedSkills: [],
          missingSkills: [],
          fitSummary: null,
          resumeTailoringTips: [],
          applicationStatus: item.applicationStatus,
        })),
    };
  }
  let savedStatusCount = 0;
  let appliedStatusCount = 0;
  let interviewStatusCount = 0;
  let offerStatusCount = 0;
  let rejectedStatusCount = 0;

  if (job) {
    const status = parseApplicationStatus(job.applicationStatus);
    if (status === "saved") savedStatusCount += 1;
    else if (status === "applied") appliedStatusCount += 1;
    else if (status === "interview") interviewStatusCount += 1;
    else if (status === "offer") offerStatusCount += 1;
    else if (status === "rejected") rejectedStatusCount += 1;
  }
  const score = job?.analysis?.matchScore ?? null;

  return {
    count: job ? 1 : 0,
    bestMatchScore: score,
    averageMatchScore: score,
    weakestMatchScore: score,
    savedStatusCount,
    appliedStatusCount,
    interviewStatusCount,
    offerStatusCount,
    rejectedStatusCount,
    latestJobs: job?.analysis
      ? [{
          title: job.title,
          matchScore: job.analysis.matchScore,
          roleAlignment: job.analysis.roleAlignment,
          matchedSkills: job.analysis.matchedSkills.slice(0, 8),
          missingSkills: job.analysis.missingSkills.slice(0, 8),
          fitSummary: job.analysis.fitSummary ?? null,
          resumeTailoringTips: job.analysis.resumeTailoringTips.slice(0, 4),
          applicationStatus: job.applicationStatus,
        }]
      : [],
  };
}

export type AnalyzeCareerBriefResult =
  | {
      ok: true;
      brief: CareerBriefView;
      preserved?: boolean;
      message?: string;
    }
  | { ok: false; message: string; status: 400 | 500 };

export async function analyzeCareerBriefForUser(
  userId: string,
  requestedJobId?: string | null,
): Promise<AnalyzeCareerBriefResult> {
  try {
    const [resume, skillsData, analytics] = await Promise.all([
      getLatestResumeAnalysisForUser(userId),
      getSkillsModuleDataForUser(userId, requestedJobId),
      getAnalyticsModuleDataForUser(userId, requestedJobId),
    ]);
    const targetJobContext = skillsData.targetJobContext;
    const jobsSummary = buildJobsSummary(
      targetJobContext.selectedJob,
      analytics,
      skillsData.scopeMode === "all_jobs",
    );

    if (!resume && jobsSummary.count === 0) {
      return {
        ok: false,
        message: "Upload or analyze a resume first to generate a CareerOS Brief.",
        status: 400,
      };
    }

    const insight =
      targetJobContext.savedJobsCount === 1 ? skillsData.insight : null;

    const skillsInput: CareerBriefSkillsInput = {
      detectedSkillsCount:
        skillsData.overview?.detectedSkills.length ?? resume?.detectedSkills.length ?? 0,
      skillCoverageScore: skillsData.overview?.skillCoverageScore ?? null,
      topGaps: (skillsData.overview?.missingSkillsFromJobs ?? []).slice(0, 8),
      insightSource: insight?.analysisSource ?? null,
      prioritySkills: (insight?.prioritySkills ?? skillsData.overview?.prioritySkills ?? [])
        .slice(0, 6)
        .map((item) => ({
          skill: item.skill,
          priority: item.priority,
          reason: "reason" in item ? String(item.reason) : undefined,
        })),
      projectIdeas: (insight?.projectIdeas ?? []).slice(0, 4),
      resumeSkillAdvice: (insight?.resumeSkillAdvice ?? []).slice(0, 6),
      marketSignals: (insight?.marketSignals ?? []).slice(0, 5),
    };

    const resumeImprovementCenter = resume
      ? buildResumeImprovementCenter({
          analysis: resume,
          targetJobContext,
        })
      : null;
    const resumeImprovementItems =
      resumeImprovementCenter?.groups
        .flatMap((group) => group.items)
        .slice(0, 8)
        .map((item) => ({
          title: item.title,
          priority: item.priority,
          reason: item.reason,
        })) ?? [];

    const input: CareerBriefAnalysisInput = {
      resume: resume
        ? {
            detectedRole: resume.role,
            experienceLevel: resume.experienceLevel,
            completenessScore: resume.completenessScore,
            detectedSkills: resume.detectedSkills.slice(0, 12),
            profileSummary: resume.profileSummary ?? null,
            strengths: resume.strengths.slice(0, 4),
            weaknesses: resume.weaknesses.slice(0, 4),
            suggestedFocus: resume.suggestedFocus.slice(0, 4),
            atsRecommendations: resume.atsRecommendations.slice(0, 7),
            resumeImprovementItems,
          }
        : null,
      jobs: jobsSummary,
      skills: skillsInput,
      analytics: {
        healthScore: analytics.careerHealth.score,
        healthLabel: analytics.careerHealth.label,
        resumeCompleteness: analytics.resume.completenessScore,
        jobActivityCount: analytics.jobs.savedJobsCount,
        averageMatch: analytics.jobs.averageMatchScore,
        skillsCoverage: analytics.skills.skillCoverageScore,
        recommendations: analytics.recommendations.slice(0, 5),
      },
      targetJob:
        skillsData.scopeMode === "selected_job" && targetJobContext.selectedJob
        ? {
            id: targetJobContext.selectedJob.id,
            title: targetJobContext.selectedJob.title,
            company: targetJobContext.selectedJob.company,
            description: targetJobContext.selectedJob.description.slice(0, 600),
            matchScore: targetJobContext.selectedJob.analysis?.matchScore ?? null,
            matchedSkills:
              targetJobContext.selectedJob.analysis?.matchedSkills.slice(0, 8) ?? [],
            missingSkills:
              targetJobContext.selectedJob.analysis?.missingSkills.slice(0, 8) ?? [],
            fitSummary:
              targetJobContext.selectedJob.analysis?.fitSummary?.slice(0, 280) ?? null,
            mode:
              targetJobContext.mode === "selected_job"
                ? "selected_job"
                : targetJobContext.mode === "all_jobs"
                  ? "all_jobs"
                  : "latest_job",
          }
        : null,
    };

    const result = await resolveCareerBrief(input);
    if (
      result.analysisSource === "rule_based" &&
      analytics.careerBrief?.analysisSource === "ai"
    ) {
      return {
        ok: true,
        brief: analytics.careerBrief,
        preserved: true,
        message: "AI refresh was unavailable. Previous AI Brief kept.",
      };
    }
    const saved = await saveCareerBrief({ userId, result });

    return { ok: true, brief: mapCareerBriefToView(saved) };
  } catch {
    return {
      ok: false,
      message: "Could not generate CareerOS Brief. Please try again.",
      status: 500,
    };
  }
}
