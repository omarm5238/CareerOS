import type { CareerBriefActionCenterSection } from "@/features/analytics/ai/types";
import type { CareerBriefRisk } from "@/features/analytics/ai/types";
import type { CareerHealthResult } from "@/features/analytics/types";
import type { CareerExecutionPlan } from "@/features/analytics/types/execution-plan";
import type { ResumeImprovementCenterData } from "@/features/resume/types/resume-improvement";
import type { SkillsInsightPrioritySkill } from "@/features/skills/types";
import type { AnalyticsJobsMetrics } from "@/features/analytics/types";
import type { SelectedTargetDeltaData } from "@/features/shared/insights";
import type { TargetJobContext } from "@/features/jobs";

export type CareerOsReportData = {
  generatedAt: string;
  briefSource: "ai" | "rule_based" | null;
  targetJobContext: TargetJobContext;
  scopeMode: "selected_job" | "all_jobs";
  selectedTargetDelta: SelectedTargetDeltaData | null;
  briefSummary: { headline: string | null; summary: string | null } | null;
  topRisks: CareerBriefRisk[];
  dataSourceNotes: string[];
  profile: {
    name: string;
    email: string;
  };
  freshness: {
    latestResumeAt: string | null;
    latestJobAt: string | null;
    currentJobCount: number;
    skillsInsightStale: boolean;
    careerBriefStale: boolean;
  };
  profileSummary: {
    role: string;
    level: string;
    completeness: number;
    analysisSource: string;
  } | null;
  careerHealth: CareerHealthResult;
  resumeImprovementCenter: ResumeImprovementCenterData | null;
  skillsPriorityPlan: SkillsInsightPrioritySkill[];
  careerExecutionPlan: CareerExecutionPlan;
  jobsSummary: AnalyticsJobsMetrics;
  actionCenter: CareerBriefActionCenterSection[];
  warnings: string[];
};
