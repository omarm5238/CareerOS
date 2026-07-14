export type RoleAlignment = "Strong" | "Partial" | "Weak" | "Unknown";

export type JobAnalysisSource = "ai" | "rule_based";

export type ApplicationStatus =
  import("../constants/application-status").ApplicationStatus;

export type JobApplicationFields = {
  applicationStatus: ApplicationStatus;
  applicationNotes: string | null;
  appliedAt: string | null;
};

export type JobMatchAnalysis = {
  matchScore: number;
  roleAlignment: RoleAlignment;
  matchedSkills: string[];
  missingSkills: string[];
  resumeSignals: string[];
  jobSignals: string[];
  recommendations: string[];
  analysisSource: JobAnalysisSource;
  aiModel?: string | null;
  fitSummary?: string | null;
  applicationStrategy: string[];
  resumeTailoringTips: string[];
  aiWarnings: string[];
};

export type RuleBasedJobMatchCore = Pick<
  JobMatchAnalysis,
  | "matchScore"
  | "roleAlignment"
  | "matchedSkills"
  | "missingSkills"
  | "resumeSignals"
  | "jobSignals"
  | "recommendations"
>;

export type CreateJobPostingInput = {
  title: string;
  company: string;
  location?: string;
  jobUrl?: string;
  description: string;
  source?: string;
};

export type JobAnalysisSummary = {
  matchScore: number;
  roleAlignment: RoleAlignment;
  matchedSkillsCount: number;
  missingSkillsCount: number;
  analysisSource: JobAnalysisSource;
};

export type JobListItem = JobApplicationFields & {
  id: string;
  title: string;
  company: string;
  location: string | null;
  source: string | null;
  createdAt: string;
  analysis: JobAnalysisSummary | null;
};

export type JobDetailView = JobApplicationFields & {
  id: string;
  title: string;
  company: string;
  location: string | null;
  jobUrl: string | null;
  description: string;
  source: string | null;
  createdAt: string;
  analysis: JobMatchAnalysis | null;
};

export type JobFormValidationResult =
  | { valid: true; data: CreateJobPostingInput }
  | { valid: false; message: string; field?: string };

export type WorkspaceJobsStatus = {
  count: number;
  appliedCount: number;
  latestMatchScore: number | null;
};

export type UpdateJobApplicationInput = {
  applicationStatus: ApplicationStatus;
  applicationNotes?: string | null;
  appliedAt?: Date | null;
};
