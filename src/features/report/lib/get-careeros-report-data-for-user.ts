import { getAnalyticsModuleDataForUser } from "@/features/analytics/server";
import {
  buildDeterministicActionCenter,
  sanitizeActionCenterSections,
} from "@/features/analytics/lib/build-deterministic-action-center";
import { buildResumeImprovementCenter } from "@/features/resume/lib/build-resume-improvement-center";
import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { getUserProfile } from "@/features/settings/server";
import { evaluateInsightFreshness } from "@/features/shared/insights/freshness";
import { getInsightSourceTimestampsForUser } from "@/features/shared/insights/get-insight-source-timestamps";
import { getSkillsModuleDataForUser } from "@/features/skills/server";
import {
  buildSelectedTargetDelta,
  ZERO_JOBS_BENCHMARKING_MESSAGE,
} from "@/features/shared/insights";

import type { CareerOsReportData } from "../types";

function isHumanFacingWarning(value: string): boolean {
  return !/\b(request was aborted|request_aborted|json[_ ]?(parse|validation)|api key|status code|job count changed|changed after this insight|timed out|provisional rule-based)\b/i.test(
    value,
  );
}

export async function getCareerOsReportDataForUser(
  userId: string,
  requestedJobId?: string | null,
): Promise<CareerOsReportData | null> {
  const [profile, resume, analytics, skillsData, sourceTimestamps] = await Promise.all([
    getUserProfile(userId),
    getLatestResumeAnalysisForUser(userId),
    getAnalyticsModuleDataForUser(userId, requestedJobId),
    getSkillsModuleDataForUser(userId, requestedJobId),
    getInsightSourceTimestampsForUser(userId),
  ]);

  if (!profile) return null;

  const brief = analytics.careerBrief;
  const insight = skillsData.insight;

  const resumeFixes = brief?.actionCenter
    .find((section) => section.section === "Resume Fixes")
    ?.items.map((item) => ({
      title: item.title,
      reason: item.reason,
      priority: item.priority,
    }));

  const improvementCenter = resume
    ? buildResumeImprovementCenter({
        analysis: resume,
        briefResumeFixes: resumeFixes,
        targetJobContext: skillsData.targetJobContext,
      })
    : null;

  const executionPlan = analytics.liveExecutionPlan;

  const skillsFreshness = insight
    ? evaluateInsightFreshness({
        generatedAt: insight.generatedAt,
        latestResumeAt: sourceTimestamps.latestResumeAt,
        latestJobAt: sourceTimestamps.latestJobAt,
        currentJobCount: sourceTimestamps.currentJobCount,
        insightJobCount: insight.jobCount,
      })
    : null;

  const briefFreshness = brief
    ? evaluateInsightFreshness({
        generatedAt: brief.generatedAt,
        latestResumeAt: sourceTimestamps.latestResumeAt,
        latestJobAt: sourceTimestamps.latestJobAt,
        currentJobCount: sourceTimestamps.currentJobCount,
      })
    : null;

  const warnings = [
    ...(brief?.warnings ?? []),
    ...(insight?.warnings ?? []),
  ].filter(isHumanFacingWarning);

  if (!resume) {
    warnings.push("No resume analysis yet. Analyze a resume to unlock fuller report sections.");
  }
  if (analytics.jobs.savedJobsCount === 0) {
    warnings.push(ZERO_JOBS_BENCHMARKING_MESSAGE);
  }
  const staleNotes: string[] = [];
  if (briefFreshness?.isStale) {
    staleNotes.push("Career Brief: Needs refresh because resume or saved-job data changed.");
  }
  if (skillsFreshness?.isStale && analytics.jobs.savedJobsCount > 0) {
    staleNotes.push(
      "All-jobs Skills Strategy: Needs refresh because saved jobs changed.",
    );
  }
  const selectedJob =
    analytics.scopeMode === "selected_job"
      ? skillsData.targetJobContext.selectedJob
      : null;
  const scopedRisks = [...(brief?.topRisks ?? [])];
  if (selectedJob?.analysis && selectedJob.analysis.matchScore < 60) {
    scopedRisks.unshift({
      title: `Low match for ${selectedJob.title}`,
      reason: `The selected target job match is ${selectedJob.analysis.matchScore}%.`,
      severity: "High",
    });
  }
  if (skillsData.overview?.experienceGaps[0]) {
    scopedRisks.push({
      title: "Experience requirement needs truthful evidence",
      reason: skillsData.overview.experienceGaps[0],
      severity: "High",
    });
  }
  if (skillsData.overview?.evidenceGaps[0]) {
    scopedRisks.push({
      title: "Proof gap for selected role",
      reason: skillsData.overview.evidenceGaps[0],
      severity: "Medium",
    });
  }

  const actionCenter = sanitizeActionCenterSections(
    buildDeterministicActionCenter(analytics),
  );

  const selectedTargetDelta =
    analytics.scopeMode === "selected_job" && skillsData.targetJobContext.selectedJob
      ? buildSelectedTargetDelta({
          jobTitle: skillsData.targetJobContext.selectedJob.title,
          company: skillsData.targetJobContext.selectedJob.company,
          matchScore: skillsData.targetJobContext.selectedJob.analysis?.matchScore,
          missingTechnicalSkills: skillsData.overview?.missingSkillsFromJobs ?? [],
          experienceGaps: skillsData.overview?.experienceGaps,
          evidenceGaps: skillsData.overview?.evidenceGaps,
          contextRequirements: skillsData.overview?.contextRequirements,
        })
      : null;

  return {
    generatedAt: new Date().toISOString(),
    briefSource: brief?.analysisSource ?? null,
    targetJobContext: skillsData.targetJobContext,
    scopeMode: analytics.scopeMode,
    selectedTargetDelta,
    briefSummary: brief
      ? { headline: brief.headline, summary: brief.summary }
      : null,
    topRisks: Array.from(
      new Map(scopedRisks.map((risk) => [risk.title.toLowerCase(), risk])).values(),
    ).slice(0, 3),
    dataSourceNotes: [...(brief?.dataSourceNotes ?? []), ...staleNotes],
    profile: {
      name: profile.name,
      email: profile.email,
    },
    freshness: {
      latestResumeAt: sourceTimestamps.latestResumeAt,
      latestJobAt: sourceTimestamps.latestJobAt,
      currentJobCount: sourceTimestamps.currentJobCount,
      skillsInsightStale: skillsFreshness?.isStale ?? false,
      careerBriefStale: briefFreshness?.isStale ?? false,
    },
    profileSummary: resume
      ? {
          role: resume.role,
          level: resume.experienceLevel,
          completeness: resume.completenessScore,
          analysisSource: resume.analysisSource,
        }
      : null,
    careerHealth: analytics.careerHealth,
    resumeImprovementCenter: improvementCenter,
    skillsPriorityPlan:
      analytics.jobs.savedJobsCount === 0
        ? []
        : analytics.scopeMode === "selected_job"
          ? (skillsData.overview?.prioritySkills ?? []).slice(0, 3).map((item) => {
              const matchingIdea = skillsData.overview?.projectIdeas.find((idea) =>
                idea.skillsProved.some(
                  (skill) => skill.toLowerCase() === item.skill.toLowerCase(),
                ),
              );
              return {
                skill: item.skill,
                priority: item.priority,
                reason: item.reason,
                evidence: item.demandSignal,
                resumeSafe: false,
                evidenceStatus: "missing_from_resume" as const,
                whyThisMatters: item.reason,
                currentEvidence: "Not yet evidenced on resume",
                learningTarget: `Build proof for ${item.skill}`,
                proofProject:
                  matchingIdea?.title ??
                  skillsData.overview?.projectIdeas[0]?.title ??
                  `Small ${item.skill} proof`,
                estimatedHours: item.estimatedEffort,
                resumeRule: "Only add after you can show real project or work evidence.",
              };
            })
          : (insight?.prioritySkills ?? []).slice(0, 5).map((item) => ({
              ...item,
              whyThisMatters: item.whyThisMatters || item.reason,
              proofProject: item.proofProject,
              estimatedHours: item.estimatedHours,
            })),
    careerExecutionPlan: executionPlan,
    jobsSummary: analytics.jobs,
    actionCenter,
    warnings: Array.from(new Set(warnings)).slice(0, 8),
  };
}
