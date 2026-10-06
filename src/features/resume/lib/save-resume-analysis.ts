import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

import type { ResumeAnalysisResult } from "../types";
import { RESUME_ANALYZER_VERSION } from "../provenance/constants";
import { extractEvidenceCatalog, packAnalysisNotes } from "../provenance/evidence-catalog";
import { ResumeTruthError } from "../provenance/errors";
import { canonicalResumeSkills } from "../provenance/normalize-resume-skills";
import { currentRecommendationTexts } from "../provenance/recommendation-freshness";
import {
  activateResumeSourceRevision,
  findOrCreateSourceRevision,
  invalidateResumeDependents,
} from "../provenance/source-revision";

type SaveResumeAnalysisInput = {
  userId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  textLength: number;
  textPreview: string;
  fullText: string;
  analysis: ResumeAnalysisResult;
};

function uniqueSkills(values: string[]): string[] {
  return canonicalResumeSkills(values).slice(0, 40);
}

export async function saveResumeAnalysis(input: SaveResumeAnalysisInput) {
  if (!input.fullText.trim()) {
    throw new ResumeTruthError("CURRENT_ANALYSIS_NOT_FOUND", "A full resume is required before a source revision can be created.");
  }

  const catalog = extractEvidenceCatalog(input.fullText);
  const detectedSkills = uniqueSkills([
    ...input.analysis.detectedSkills,
    ...catalog.skills.map((skill) => skill.label),
  ]);
  const atsRecommendations = currentRecommendationTexts(input.analysis.atsRecommendations, catalog);

  const write = async () => prisma.$transaction(async (tx) => {
    const document = await tx.resumeDocument.create({
      data: {
        userId: input.userId,
        filename: input.filename,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        textLength: input.textLength,
        textPreview: input.textPreview,
      },
    });

    const resolved = await findOrCreateSourceRevision(tx, {
      userId: input.userId,
      resumeDocumentId: document.id,
      sourceFilename: input.filename,
      fullText: input.fullText,
    });
    const activation = await activateResumeSourceRevision(tx, {
      userId: input.userId,
      revisionId: resolved.revision.id,
    });
    if (!activation) {
      throw new ResumeTruthError("RESUME_REVISION_MISMATCH");
    }

    const analysis = await tx.resumeAnalysis.create({
      data: {
        resumeDocumentId: document.id,
        detectedRole: input.analysis.role,
        experienceLevel: input.analysis.experienceLevel,
        completenessScore: input.analysis.completenessScore,
        detectedSkills,
        suggestedFocus: input.analysis.suggestedFocus,
        warnings: input.analysis.warnings,
        profileSummary: input.analysis.profileSummary || null,
        strengths: input.analysis.strengths,
        weaknesses: input.analysis.weaknesses,
        atsRecommendations,
        analysisSource: input.analysis.analysisSource,
        aiModel: input.analysis.model ?? null,
        aiWarnings: packAnalysisNotes(input.analysis.aiWarnings ?? [], catalog),
        analyzerVersion: RESUME_ANALYZER_VERSION,
        sourceContentHash: resolved.contentHash,
        freshness: "CURRENT",
        staleReason: null,
        sourceRevisionId: resolved.revision.id,
      },
    });

    await invalidateResumeDependents(tx, {
      userId: input.userId,
      revisionId: resolved.revision.id,
      contentHash: resolved.contentHash,
      keepAnalysisId: analysis.id,
      activeRevisionChanged: activation.changed,
    });

    console.info(JSON.stringify({
      event: "resume_source_revision_established",
      userId: input.userId,
      revisionId: resolved.revision.id,
      analysisId: analysis.id,
      reused: resolved.reused,
    }));

    return tx.resumeDocument.findFirstOrThrow({
      where: { id: document.id },
      include: { analysis: true },
    });
  });

  try {
    return await write();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return write();
    }
    throw error;
  }
}
