import { prisma } from "@/server/db/prisma";

import type { ResumeAnalysisResult } from "../types";

type SaveResumeAnalysisInput = {
  userId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  textLength: number;
  textPreview: string;
  analysis: ResumeAnalysisResult;
};

export async function saveResumeAnalysis(input: SaveResumeAnalysisInput) {
  return prisma.resumeDocument.create({
    data: {
      userId: input.userId,
      filename: input.filename,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      textLength: input.textLength,
      textPreview: input.textPreview,
      analysis: {
        create: {
          detectedRole: input.analysis.role,
          experienceLevel: input.analysis.experienceLevel,
          completenessScore: input.analysis.completenessScore,
          detectedSkills: input.analysis.detectedSkills,
          suggestedFocus: input.analysis.suggestedFocus,
          warnings: input.analysis.warnings,
          profileSummary: input.analysis.profileSummary || null,
          strengths: input.analysis.strengths,
          weaknesses: input.analysis.weaknesses,
          atsRecommendations: input.analysis.atsRecommendations,
          analysisSource: input.analysis.analysisSource,
          aiModel: input.analysis.model ?? null,
          aiWarnings: input.analysis.aiWarnings ?? [],
        },
      },
    },
    include: {
      analysis: true,
    },
  });
}
