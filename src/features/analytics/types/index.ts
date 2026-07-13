import type { AnalysisSource } from "@/features/resume";

export type CareerHealthLabel =
  | "Strong"
  | "Developing"
  | "Needs Work"
  | "Not Enough Data";

export type CareerHealthResult = {
  score: number;
  label: CareerHealthLabel;
  explanation: string;
};

export type AnalyticsResumeMetrics = {
  hasResume: boolean;
  latestRole: string | null;
  latestExperienceLevel: string | null;
  completenessScore: number | null;
  resumeAnalysesCount: number;
  detectedSkillsCount: number;
  analysisSource: AnalysisSource | null;
};

export type AnalyticsJobsMetrics = {
  savedJobsCount: number;
  averageMatchScore: number | null;
  bestMatchScore: number | null;
  weakestMatchScore: number | null;
  strongMatchesCount: number;
  partialMatchesCount: number;
  weakMatchesCount: number;
};

export type AnalyticsSkillsMetrics = {
  detectedSkillsCount: number;
  skillCoverageScore: number | null;
  prioritySkillsCount: number;
  gapsCount: number;
  topPrioritySkills: string[];
};

export type AnalyticsModuleData = {
  careerHealth: CareerHealthResult;
  resume: AnalyticsResumeMetrics;
  jobs: AnalyticsJobsMetrics;
  skills: AnalyticsSkillsMetrics;
  recommendations: string[];
  hasUsableData: boolean;
};

export type WorkspaceAnalyticsStatus = {
  careerHealthScore: number | null;
  careerHealthLabel: CareerHealthLabel | null;
  hasUsableData: boolean;
};
