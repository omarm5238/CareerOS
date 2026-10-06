import { prisma } from "@/server/db/prisma";

import { mapResumeDocumentToModuleAnalysis } from "../lib/map-resume-document-to-module-analysis";
import type { ResumeModuleAnalysis } from "../types";
import { RESUME_ANALYZER_VERSION } from "./constants";
import { readAnalysisNotes } from "./evidence-catalog";
import { ResumeTruthError } from "./errors";
import type { EvidenceCatalog } from "./evidence-catalog";

export type ActiveResumeRevision = {
  resumeId: string;
  revisionId: string;
  sourceFilename: string;
  revisionNumber: number;
  contentHash: string;
  uploadedAt: Date;
  createdAt: Date;
  activatedAt: Date | null;
  isActive: true;
};

export async function getActiveResumeRevisionForUser(userId: string): Promise<ActiveResumeRevision | null> {
  const revision = await prisma.resumeSourceRevision.findFirst({
    where: { userId, isActive: true },
    include: { resumeDocument: { select: { id: true, createdAt: true } } },
  });
  if (!revision) return null;
  return {
    resumeId: revision.resumeDocumentId,
    revisionId: revision.id,
    sourceFilename: revision.sourceFilename,
    revisionNumber: revision.revisionNumber,
    contentHash: revision.contentHash,
    uploadedAt: revision.resumeDocument.createdAt,
    createdAt: revision.createdAt,
    activatedAt: revision.activatedAt,
    isActive: true,
  };
}

export async function requireActiveResumeRevision(userId: string): Promise<ActiveResumeRevision> {
  const active = await getActiveResumeRevisionForUser(userId);
  if (!active) throw new ResumeTruthError("NO_ACTIVE_RESUME");
  return active;
}

export type CurrentResumeAnalysis = {
  analysisId: string;
  resumeDocumentId: string;
  sourceRevisionId: string;
  sourceContentHash: string;
  analyzerVersion: string;
  detectedRole: string;
  experienceLevel: string;
  detectedSkills: string[];
  catalog: EvidenceCatalog | null;
  createdAt: Date;
};

export async function getCurrentResumeAnalysis(userId: string): Promise<CurrentResumeAnalysis | null> {
  const active = await getActiveResumeRevisionForUser(userId);
  if (!active) return null;

  const mismatched = await prisma.resumeAnalysis.findMany({
    where: {
      sourceRevisionId: active.revisionId,
      freshness: "CURRENT",
      resumeDocument: { userId },
      OR: [
        { sourceContentHash: { not: active.contentHash } },
        { analyzerVersion: { not: RESUME_ANALYZER_VERSION } },
      ],
    },
    select: { id: true, sourceContentHash: true, analyzerVersion: true },
  });
  if (mismatched.length > 0) {
    const hashIds = mismatched.filter((row) => row.sourceContentHash !== active.contentHash).map((row) => row.id);
    const versionIds = mismatched.filter((row) => row.analyzerVersion !== RESUME_ANALYZER_VERSION && !hashIds.includes(row.id)).map((row) => row.id);
    if (hashIds.length > 0) {
      await prisma.resumeAnalysis.updateMany({
        where: { id: { in: hashIds } },
        data: { freshness: "STALE", staleReason: "SOURCE_CONTENT_CHANGED" },
      });
    }
    if (versionIds.length > 0) {
      await prisma.resumeAnalysis.updateMany({
        where: { id: { in: versionIds } },
        data: { freshness: "STALE", staleReason: "ANALYZER_VERSION_CHANGED" },
      });
    }
  }

  const analysis = await prisma.resumeAnalysis.findFirst({
    where: {
      sourceRevisionId: active.revisionId,
      sourceContentHash: active.contentHash,
      analyzerVersion: RESUME_ANALYZER_VERSION,
      freshness: "CURRENT",
      resumeDocument: { userId },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!analysis?.sourceRevisionId || !analysis.sourceContentHash || !analysis.analyzerVersion) return null;
  const skills = Array.isArray(analysis.detectedSkills)
    ? analysis.detectedSkills.filter((item): item is string => typeof item === "string")
    : [];
  return {
    analysisId: analysis.id,
    resumeDocumentId: analysis.resumeDocumentId,
    sourceRevisionId: analysis.sourceRevisionId,
    sourceContentHash: analysis.sourceContentHash,
    analyzerVersion: analysis.analyzerVersion,
    detectedRole: analysis.detectedRole,
    experienceLevel: analysis.experienceLevel,
    detectedSkills: skills,
    catalog: readAnalysisNotes(analysis.aiWarnings).catalog,
    createdAt: analysis.createdAt,
  };
}

export async function describeShownResume(userId: string, resumeDocumentId: string | null) {
  const active = await getActiveResumeRevisionForUser(userId);
  const current = await getCurrentResumeAnalysis(userId);
  if (!active) {
    return { active, current, mode: "legacy" as const };
  }
  if (!resumeDocumentId) {
    return { active, current, mode: current ? "current" as const : "historical" as const };
  }
  const row = await prisma.resumeAnalysis.findFirst({
    where: { resumeDocumentId, resumeDocument: { userId } },
    select: { id: true, freshness: true },
  });
  if (current && row?.id === current.analysisId) {
    return { active, current, mode: "current" as const };
  }
  return {
    active,
    current,
    mode: row?.freshness === "STALE" ? "outdated" as const : "historical" as const,
  };
}

export type CurrentResumeContext =
  | { status: "CURRENT"; revision: ActiveResumeRevision; analysis: ResumeModuleAnalysis }
  | { status: "NO_ACTIVE_RESUME"; revision: null; analysis: null }
  | { status: "CURRENT_ANALYSIS_NOT_FOUND"; revision: ActiveResumeRevision; analysis: null };

export async function getCurrentResumeContextForUser(userId: string): Promise<CurrentResumeContext> {
  const revision = await getActiveResumeRevisionForUser(userId);
  if (!revision) return { status: "NO_ACTIVE_RESUME", revision: null, analysis: null };

  const current = await getCurrentResumeAnalysis(userId);
  if (!current || current.sourceRevisionId !== revision.revisionId || current.sourceContentHash !== revision.contentHash) {
    return { status: "CURRENT_ANALYSIS_NOT_FOUND", revision, analysis: null };
  }

  const document = await prisma.resumeDocument.findFirst({
    where: { id: current.resumeDocumentId, userId },
    include: { analysis: true },
  });
  if (!document?.analysis || document.analysis.id !== current.analysisId) {
    return { status: "CURRENT_ANALYSIS_NOT_FOUND", revision, analysis: null };
  }

  return {
    status: "CURRENT",
    revision,
    analysis: mapResumeDocumentToModuleAnalysis({
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      textLength: document.textLength,
      analysis: document.analysis,
    }),
  };
}

export async function requireCurrentResumeAnalysis(userId: string): Promise<CurrentResumeAnalysis> {
  const active = await getActiveResumeRevisionForUser(userId);
  if (!active) throw new ResumeTruthError("NO_ACTIVE_RESUME");
  const current = await getCurrentResumeAnalysis(userId);
  if (!current) throw new ResumeTruthError("CURRENT_ANALYSIS_NOT_FOUND");
  return current;
}
