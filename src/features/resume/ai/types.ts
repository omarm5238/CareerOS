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
};

export type ResumeAIAnalysisResult = ResumeAIAnalysisCore;

export type AnalyzeResumeWithAiInput = {
  text: string;
  resumeMeta: {
    filename: string;
    fileSize: number;
  };
  extractionWarnings?: string[];
};

export type OpenAIResumeAnalysisPayload = {
  role?: unknown;
  experienceLevel?: unknown;
  completenessScore?: unknown;
  detectedSkills?: unknown;
  suggestedFocus?: unknown;
  strengths?: unknown;
  weaknesses?: unknown;
  atsRecommendations?: unknown;
  profileSummary?: unknown;
  warnings?: unknown;
};
