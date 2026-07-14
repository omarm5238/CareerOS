import type { RoleAlignment } from "../types";

export type JobAnalysisSource = "ai" | "rule_based";

export type JobMatchResumeInput = {
  detectedRole: string;
  experienceLevel: string;
  completenessScore: number;
  detectedSkills: string[];
  profileSummary: string | null;
  strengths: string[];
  weaknesses: string[];
  suggestedFocus: string[];
  atsRecommendations: string[];
};

export type JobMatchJobInput = {
  title: string;
  company: string;
  location: string | null;
  description: string;
  source: string | null;
  jobUrl: string | null;
};

export type JobMatchAnalysisInput = {
  job: JobMatchJobInput;
  resume: JobMatchResumeInput | null;
};

export type JobMatchAIAnalysisPayload = {
  matchScore?: unknown;
  roleAlignment?: unknown;
  matchedSkills?: unknown;
  missingSkills?: unknown;
  resumeSignals?: unknown;
  jobSignals?: unknown;
  recommendations?: unknown;
  fitSummary?: unknown;
  applicationStrategy?: unknown;
  resumeTailoringTips?: unknown;
  warnings?: unknown;
};

export type JobMatchAnalysisResult = {
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
