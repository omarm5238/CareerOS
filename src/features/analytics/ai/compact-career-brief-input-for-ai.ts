import type { CareerBriefAnalysisInput } from "./types";
import { classifyRequirement } from "@/features/shared/insights";

export function compactCareerBriefInputForAi(
  input: CareerBriefAnalysisInput,
): CareerBriefAnalysisInput {
  const resume = input.resume
    ? {
        ...input.resume,
        detectedSkills: input.resume.detectedSkills.slice(0, 12),
        strengths: input.resume.strengths.slice(0, 5),
        weaknesses: input.resume.weaknesses.slice(0, 5),
        suggestedFocus: input.resume.suggestedFocus.slice(0, 5),
        atsRecommendations: input.resume.atsRecommendations.slice(0, 7),
        resumeImprovementItems: input.resume.resumeImprovementItems.slice(0, 8),
        profileSummary:
          input.resume.profileSummary && input.resume.profileSummary.length <= 280
            ? input.resume.profileSummary
            : input.resume.profileSummary
              ? input.resume.profileSummary.slice(0, 280)
              : null,
      }
    : null;

  return {
    resume,
    jobs: {
      ...input.jobs,
      latestJobs: input.jobs.latestJobs.slice(0, 3).map((job) => ({
        ...job,
        matchedSkills: job.matchedSkills.slice(0, 8),
        missingSkills: job.missingSkills.slice(0, 8),
        resumeTailoringTips: job.resumeTailoringTips.slice(0, 4),
        fitSummary: job.fitSummary ? job.fitSummary.slice(0, 280) : null,
      })),
    },
    skills: {
      ...input.skills,
      topGaps: input.skills.topGaps
        .filter((item) => classifyRequirement(item).kind === "skill")
        .slice(0, 8),
      prioritySkills: input.skills.prioritySkills.slice(0, 6),
      projectIdeas: input.skills.projectIdeas.slice(0, 4),
      resumeSkillAdvice: input.skills.resumeSkillAdvice.slice(0, 6),
      marketSignals: input.skills.marketSignals.slice(0, 5),
    },
    analytics: {
      ...input.analytics,
      recommendations: input.analytics.recommendations.slice(0, 8),
    },
    targetJob: input.targetJob
      ? {
          ...input.targetJob,
          description: input.targetJob.description.slice(0, 600),
          matchedSkills: input.targetJob.matchedSkills.slice(0, 8),
          missingSkills: input.targetJob.missingSkills
            .filter((item) => classifyRequirement(item).kind === "skill")
            .slice(0, 8),
          fitSummary: input.targetJob.fitSummary?.slice(0, 280) ?? null,
        }
      : null,
  };
}
