import type { CareerExecutionPlan } from "../types/execution-plan";

export type CareerBriefSource = "ai" | "rule_based";

export type CareerBriefSeverity = "High" | "Medium" | "Low";

export type CareerBriefActionCategory = "Skills" | "Resume" | "Jobs" | "Applications";

export type CareerBriefActionSection =
  | "Today"
  | "This Week"
  | "Resume Fixes"
  | "Skill Proof Needed"
  | "Job Actions"
  | "Interview Prep"
  | "Portfolio Proof"
  | "Job Follow-ups";
export type CareerBriefResumeInput = {
  detectedRole: string;
  experienceLevel: string;
  completenessScore: number;
  detectedSkills: string[];
  profileSummary: string | null;
  strengths: string[];
  weaknesses: string[];
  suggestedFocus: string[];
  atsRecommendations: string[];
  resumeImprovementItems: Array<{
    title: string;
    priority: string;
    reason: string;
  }>;
};

export type CareerBriefJobInput = {
  title: string;
  matchScore: number;
  roleAlignment: string;
  matchedSkills: string[];
  missingSkills: string[];
  fitSummary: string | null;
  resumeTailoringTips: string[];
  applicationStatus: string;
};

export type CareerBriefJobsSummary = {
  count: number;
  bestMatchScore: number | null;
  averageMatchScore: number | null;
  weakestMatchScore: number | null;
  savedStatusCount: number;
  appliedStatusCount: number;
  interviewStatusCount: number;
  offerStatusCount: number;
  rejectedStatusCount: number;
  latestJobs: CareerBriefJobInput[];
};

export type CareerBriefSkillsInput = {
  detectedSkillsCount: number;
  skillCoverageScore: number | null;
  topGaps: string[];
  insightSource: CareerBriefSource | null;
  prioritySkills: Array<{ skill: string; priority: string; reason?: string }>;
  projectIdeas: Array<{ title: string; skills: string[]; proof: string }>;
  resumeSkillAdvice: Array<{ skill: string; advice: string; action: string }>;
  marketSignals: string[];
};

export type CareerBriefAnalyticsInput = {
  healthScore: number;
  healthLabel: string;
  resumeCompleteness: number | null;
  jobActivityCount: number;
  averageMatch: number | null;
  skillsCoverage: number | null;
  recommendations: string[];
};

export type CareerBriefAnalysisInput = {
  resume: CareerBriefResumeInput | null;
  jobs: CareerBriefJobsSummary;
  skills: CareerBriefSkillsInput;
  analytics: CareerBriefAnalyticsInput;
  targetJob: {
    id: string;
    title: string;
    company: string;
    description: string;
    matchScore: number | null;
    matchedSkills: string[];
    missingSkills: string[];
    fitSummary: string | null;
    mode: "selected_job" | "latest_job" | "all_jobs";
  } | null;
};

export type CareerBriefRisk = {
  title: string;
  reason: string;
  severity: CareerBriefSeverity;
};

export type CareerBriefOpportunity = {
  title: string;
  reason: string;
  impact: CareerBriefSeverity;
};

export type CareerBriefNextAction = {
  title: string;
  category: CareerBriefActionCategory;
  priority: CareerBriefSeverity;
  reason: string;
};

export type CareerBriefPlanItem = {
  week: string;
  focus: string;
  outcome: string;
};

export type CareerBriefActionItem = {
  title: string;
  reason: string;
  priority: CareerBriefSeverity;
};

export type CareerBriefActionCenterSection = {
  section: CareerBriefActionSection;
  items: CareerBriefActionItem[];
};

export type CareerBriefResult = {
  healthScore: number;
  headline: string;
  summary: string;
  topRisks: CareerBriefRisk[];
  topOpportunities: CareerBriefOpportunity[];
  nextActions: CareerBriefNextAction[];
  thirtyDayPlan: CareerBriefPlanItem[];
  careerExecutionPlan: CareerExecutionPlan;
  actionCenter: CareerBriefActionCenterSection[];
  warnings: string[];
  dataSourceNotes: string[];
  analysisSource: CareerBriefSource;
  aiModel?: string | null;
};

export type CareerBriefAIPayload = {
  healthScore?: unknown;
  summaryTitle?: unknown;
  summary?: unknown;
  risks?: unknown;
  nextActions?: unknown;
  thirtyDayPlan?: unknown;
  actionCenter?: unknown;
  warnings?: unknown;
  dataSourceNotes?: unknown;
};
