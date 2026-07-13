import type { AnalysisSource, ResumeModuleAnalysis } from "../types";

type ResumeDocumentWithAnalysis = {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  textLength: number;
  analysis: {
    id: string;
    detectedRole: string;
    experienceLevel: string;
    completenessScore: number;
    detectedSkills: unknown;
    suggestedFocus: unknown;
    strengths: unknown;
    weaknesses: unknown;
    atsRecommendations: unknown;
    profileSummary: string | null;
    analysisSource: string;
    createdAt: Date;
  };
};

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parseAnalysisSource(value: unknown): AnalysisSource {
  return value === "ai" ? "ai" : "rule_based";
}

export function mapResumeDocumentToModuleAnalysis(
  document: ResumeDocumentWithAnalysis,
): ResumeModuleAnalysis {
  return {
    resumeDocumentId: document.id,
    analysisId: document.analysis.id,
    role: document.analysis.detectedRole,
    experienceLevel: document.analysis.experienceLevel,
    completenessScore: document.analysis.completenessScore,
    filename: document.filename,
    fileSize: document.fileSize,
    textLength: document.textLength,
    mimeType: document.mimeType,
    detectedSkills: parseStringArray(document.analysis.detectedSkills),
    suggestedFocus: parseStringArray(document.analysis.suggestedFocus),
    strengths: parseStringArray(document.analysis.strengths),
    weaknesses: parseStringArray(document.analysis.weaknesses),
    atsRecommendations: parseStringArray(document.analysis.atsRecommendations),
    profileSummary: document.analysis.profileSummary,
    analysisSource: parseAnalysisSource(document.analysis.analysisSource),
    analyzedAt: document.analysis.createdAt.toISOString(),
  };
}

export { parseStringArray };
