import type { AnalysisSource, ResumeAnalysisResult } from "@/features/resume";

export type OnboardingStep = "welcome" | "upload" | "processing" | "analysis";

export type ProcessingStageId =
  | "reading"
  | "identifying"
  | "extracting"
  | "building";

export type OnboardingProfile = {
  role: string;
  experienceLevel: string;
  completenessScore: number;
  detectedSkills: string[];
  suggestedFocus: string[];
  profileSummary?: string;
  analysisSource?: AnalysisSource;
};

export type OnboardingStoredState = {
  version: 1;
  completed: boolean;
  completedAt: string;
  resume: {
    filename: string;
    fileSize: number;
  };
  profile: OnboardingProfile;
};

export type OnboardingFlowState = {
  step: OnboardingStep;
  selectedFile: File | null;
  analysisResult: ResumeAnalysisResult | null;
  error: string | null;
  isDragging: boolean;
  progress: number;
  processingStage: ProcessingStageId;
  isProcessingLocked: boolean;
};
