export type ExperienceLevel = "Entry / Junior" | "Mid-Level" | "Senior";

export type AnalysisSource = "ai" | "rule_based";

export type ResumeAIAnalysisCore = {
  role: string;
  experienceLevel: ExperienceLevel;
  completenessScore: number;
  detectedSkills: string[];
  suggestedFocus: string[];
  strengths: string[];
  weaknesses: string[];
  atsRecommendations: string[];
  profileSummary: string;
  warnings: string[];
  analysisSource: AnalysisSource;
  model?: string;
  aiWarnings?: string[];
};

export type ResumeAnalysisResult = ResumeAIAnalysisCore & {
  resume: {
    filename: string;
    fileSize: number;
    textLength: number;
  };
  resumeDocumentId?: string;
  analysisId?: string;
};

export type WorkspaceProfile = {
  role: string;
  experienceLevel: string;
  completenessScore: number;
  filename: string;
  fileSize: number;
  textLength: number;
  detectedSkills: string[];
  profileSummary?: string | null;
  analysisSource: AnalysisSource;
};

export type ResumeModuleAnalysis = WorkspaceProfile & {
  resumeDocumentId: string;
  analysisId: string;
  suggestedFocus: string[];
  strengths: string[];
  weaknesses: string[];
  atsRecommendations: string[];
  mimeType: string;
  analyzedAt: string;
};

export type ResumeAnalysisHistoryItem = {
  resumeDocumentId: string;
  analysisId: string;
  filename: string;
  detectedRole: string;
  experienceLevel: string;
  completenessScore: number;
  detectedSkillsCount: number;
  analysisSource: AnalysisSource;
  createdAt: string;
};

export type ResumeActionPriority = "High" | "Medium" | "Low";

export type ResumeActionSource =
  | "ATS Recommendation"
  | "Missing Item"
  | "Suggested Focus"
  | "Skills Gap";

export type ResumeActionItem = {
  id: string;
  title: string;
  priority: ResumeActionPriority;
  reason: string;
  suggestedFix: string;
  source: ResumeActionSource;
};

export type ResumeValidationResult =
  | { valid: true; mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
  | { valid: false; message: string };
