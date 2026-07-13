import { prisma } from "@/server/db/prisma";

import type { ResumeAnalysisHistoryItem } from "../types";
import { parseAnalysisSource, parseStringArray } from "./map-resume-document-to-module-analysis";

const HISTORY_LIMIT = 10;

export async function getResumeAnalysisHistoryForUser(
  userId: string,
): Promise<ResumeAnalysisHistoryItem[]> {
  const documents = await prisma.resumeDocument.findMany({
    where: {
      userId,
      analysis: { isNot: null },
    },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    include: { analysis: true },
  });

  return documents
    .filter((document) => document.analysis !== null)
    .map((document) => {
      const analysis = document.analysis!;

      return {
        resumeDocumentId: document.id,
        analysisId: analysis.id,
        filename: document.filename,
        detectedRole: analysis.detectedRole,
        experienceLevel: analysis.experienceLevel,
        completenessScore: analysis.completenessScore,
        detectedSkillsCount: parseStringArray(analysis.detectedSkills).length,
        analysisSource: parseAnalysisSource(analysis.analysisSource),
        createdAt: analysis.createdAt.toISOString(),
      };
    });
}
