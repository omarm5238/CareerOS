import type { AnalysisSource } from "@/features/resume";
import type { TargetJobContext } from "@/features/jobs";
import type { SelectedTargetDeltaData } from "@/features/shared/insights";

import type {
  CareerBriefActionCenterSection,
  CareerBriefNextAction,
  CareerBriefOpportunity,
  CareerBriefPlanItem,
  CareerBriefRisk,
  CareerBriefSource,
} from "../ai/types";
import type { CareerExecutionPlan } from "./execution-plan";

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
  aiAnalyzedCount: number;
  ruleBasedAnalyzedCount: number;
  savedStatusCount: number;
  appliedStatusCount: number;
  interviewStatusCount: number;
  offerStatusCount: number;
  rejectedStatusCount: number;
};

export type AnalyticsSkillsMetrics = {
  detectedSkillsCount: number;
  skillCoverageScore: number | null;
  prioritySkillsCount: number;
  gapsCount: number;
  topPrioritySkills: string[];
  skillsInsightSource: "ai" | "rule_based" | null;
  skillsInsightGeneratedAt: string | null;
};

export type CareerBriefView = {
  id: string;
  analysisSource: CareerBriefSource;
  aiModel: string | null;
  healthScore: number;
  headline: string | null;
  summary: string | null;
  topRisks: CareerBriefRisk[];
  topOpportunities: CareerBriefOpportunity[];
  nextActions: CareerBriefNextAction[];
  thirtyDayPlan: CareerBriefPlanItem[];
  careerExecutionPlan: CareerExecutionPlan | null;
  actionCenter: CareerBriefActionCenterSection[];
  warnings: string[];
  dataSourceNotes: string[];
  generatedAt: string;
  isStale: boolean;
  staleReason: string | null;
};

export type AnalyticsModuleData = {
  careerHealth: CareerHealthResult;
  resume: AnalyticsResumeMetrics;
  jobs: AnalyticsJobsMetrics;
  skills: AnalyticsSkillsMetrics;
  recommendations: string[];
  hasUsableData: boolean;
  careerBrief: CareerBriefView | null;
  liveExecutionPlan: CareerExecutionPlan;
  targetJobContext: TargetJobContext;
  scopeMode: "selected_job" | "all_jobs";
  selectedTargetDelta: SelectedTargetDeltaData | null;
};

export type WorkspaceAnalyticsStatus = {
  careerHealthScore: number | null;
  careerHealthLabel: CareerHealthLabel | null;
  hasUsableData: boolean;
};
