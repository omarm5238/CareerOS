import { prisma } from "@/server/db/prisma";

import type { ResumeVersionDetail, ResumeVersionRevisionDetail } from "../types";
import {
  parseChangeLog,
  parseEvidenceNotes,
  parseInputSnapshot,
  parseKeywordCoverage,
  parseResumeVersionContent,
  parseWarnings,
} from "./json-parsers";
import { assertResumeVersionOwnedByUser } from "./resume-version-permissions";

function mapRevisionDetail(revision: {
  id: string;
  resumeVersionId: string;
  revisionNumber: number;
  source: string;
  generationStatus: string;
  contentJson: unknown;
  keywordCoverageJson: unknown;
  warningsJson: unknown;
  changeLogJson: unknown;
  evidenceNotesJson: unknown;
  inputSnapshotJson: unknown;
  alignmentScoreBefore: number | null;
  alignmentScoreAfter: number | null;
  model: string | null;
  aiSource: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ResumeVersionRevisionDetail {
  return {
    id: revision.id,
    resumeVersionId: revision.resumeVersionId,
    revisionNumber: revision.revisionNumber,
    source: revision.source,
    generationStatus: revision.generationStatus,
    content: parseResumeVersionContent(revision.contentJson),
    keywordCoverage: parseKeywordCoverage(revision.keywordCoverageJson),
    warnings: parseWarnings(revision.warningsJson),
    changeLog: parseChangeLog(revision.changeLogJson),
    evidenceNotes: parseEvidenceNotes(revision.evidenceNotesJson),
    inputSnapshot: parseInputSnapshot(revision.inputSnapshotJson),
    alignmentScoreBefore: revision.alignmentScoreBefore,
    alignmentScoreAfter: revision.alignmentScoreAfter,
    model: revision.model,
    aiSource: revision.aiSource,
    errorMessage: revision.errorMessage,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
  };
}

export async function getResumeVersionDetailForUser(
  userId: string,
  versionId: string,
): Promise<ResumeVersionDetail> {
  await assertResumeVersionOwnedByUser(userId, versionId);

  const version = await prisma.resumeVersion.findFirst({
    where: { id: versionId, userId },
    include: {
      sourceResumeDocument: {
        select: { id: true, filename: true },
      },
      targetJob: {
        select: { id: true, title: true, company: true },
      },
      activeRevision: true,
      revisions: {
        orderBy: { revisionNumber: "desc" },
      },
    },
  });

  if (!version) {
    throw new Error("Resume version not found for this user.");
  }

  return {
    id: version.id,
    title: version.title,
    type: version.type,
    status: version.status,
    sourceResumeDocumentId: version.sourceResumeDocumentId,
    sourceResumeAnalysisId: version.sourceResumeAnalysisId,
    sourceResumeFilename: version.sourceResumeDocument?.filename ?? null,
    targetJobId: version.targetJobId,
    targetJobAnalysisId: version.targetJobAnalysisId,
    targetJobTitle: version.targetJob?.title ?? null,
    targetJobCompany: version.targetJob?.company ?? null,
    activeRevisionId: version.activeRevisionId,
    alignmentScoreBefore: version.alignmentScoreBefore,
    alignmentScoreAfter: version.alignmentScoreAfter,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
    archivedAt: version.archivedAt?.toISOString() ?? null,
    activeRevision: version.activeRevision
      ? mapRevisionDetail(version.activeRevision)
      : null,
    revisions: version.revisions.map((revision) => ({
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      source: revision.source,
      generationStatus: revision.generationStatus,
      alignmentScoreBefore: revision.alignmentScoreBefore,
      alignmentScoreAfter: revision.alignmentScoreAfter,
      model: revision.model,
      aiSource: revision.aiSource,
      createdAt: revision.createdAt.toISOString(),
      updatedAt: revision.updatedAt.toISOString(),
    })),
  };
}
