import type { SkillsInsightAnalysisInput } from "./types";

const INPUT_LIMITS = {
  detectedSkills: 12,
  strengths: 4,
  weaknesses: 4,
  suggestedFocus: 4,
  jobs: 5,
  matchedSkillsPerJob: 8,
  missingSkillsPerJob: 8,
  jobSignalsPerJob: 6,
  resumeTailoringTipsPerJob: 4,
  missingSkillsFromJobs: 10,
  matchedSkillsFromJobs: 10,
  prioritySkills: 6,
  recommendations: 4,
} as const;

export function compactSkillsInsightInputForAi(
  input: SkillsInsightAnalysisInput,
): SkillsInsightAnalysisInput {
  return {
    resume: {
      detectedRole: input.resume.detectedRole,
      experienceLevel: input.resume.experienceLevel,
      completenessScore: input.resume.completenessScore,
      detectedSkills: input.resume.detectedSkills.slice(0, INPUT_LIMITS.detectedSkills),
      profileSummary: null,
      strengths: input.resume.strengths.slice(0, INPUT_LIMITS.strengths),
      weaknesses: input.resume.weaknesses.slice(0, INPUT_LIMITS.weaknesses),
      suggestedFocus: input.resume.suggestedFocus.slice(0, INPUT_LIMITS.suggestedFocus),
      atsRecommendations: [],
    },
    jobs: input.jobs.slice(0, INPUT_LIMITS.jobs).map((job) => ({
      title: job.title,
      company: job.company,
      matchScore: job.matchScore,
      roleAlignment: job.roleAlignment,
      matchedSkills: job.matchedSkills.slice(0, INPUT_LIMITS.matchedSkillsPerJob),
      missingSkills: job.missingSkills.slice(0, INPUT_LIMITS.missingSkillsPerJob),
      jobSignals: job.jobSignals.slice(0, INPUT_LIMITS.jobSignalsPerJob),
      fitSummary: null,
      resumeTailoringTips: job.resumeTailoringTips.slice(0, INPUT_LIMITS.resumeTailoringTipsPerJob),
    })),
    overview: {
      ...input.overview,
      detectedSkills: input.overview.detectedSkills.slice(0, INPUT_LIMITS.detectedSkills),
      missingSkillsFromJobs: input.overview.missingSkillsFromJobs.slice(
        0,
        INPUT_LIMITS.missingSkillsFromJobs,
      ),
      matchedSkillsFromJobs: input.overview.matchedSkillsFromJobs.slice(
        0,
        INPUT_LIMITS.matchedSkillsFromJobs,
      ),
      prioritySkills: input.overview.prioritySkills.slice(0, INPUT_LIMITS.prioritySkills),
      recommendations: input.overview.recommendations.slice(0, INPUT_LIMITS.recommendations),
    },
  };
}
