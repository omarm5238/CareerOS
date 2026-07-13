export type RoleAlignment = "Strong" | "Partial" | "Weak" | "Unknown";

export type JobMatchAnalysis = {
  matchScore: number;
  roleAlignment: RoleAlignment;
  matchedSkills: string[];
  missingSkills: string[];
  resumeSignals: string[];
  jobSignals: string[];
  recommendations: string[];
};

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
};

export type JobListItem = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  source: string | null;
  createdAt: string;
  analysis: JobAnalysisSummary | null;
};

export type JobDetailView = {
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
  latestMatchScore: number | null;
};
