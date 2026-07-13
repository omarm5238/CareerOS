import { prisma } from "@/server/db/prisma";

import type { ResumeModuleAnalysis } from "../types";
import { mapResumeDocumentToModuleAnalysis } from "./map-resume-document-to-module-analysis";

export async function getLatestResumeAnalysisForUser(
  userId: string,
): Promise<ResumeModuleAnalysis | null> {
  const document = await prisma.resumeDocument.findFirst({
    where: {
      userId,
      analysis: { isNot: null },
    },
    orderBy: { createdAt: "desc" },
    include: { analysis: true },
  });

  if (!document?.analysis) {
    return null;
  }

  return mapResumeDocumentToModuleAnalysis({
    id: document.id,
    filename: document.filename,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    textLength: document.textLength,
    analysis: document.analysis,
  });
}
