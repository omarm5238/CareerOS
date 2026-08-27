import { prisma } from "@/server/db/prisma";

import type { ResumeVersionType } from "@/generated/prisma/client";

import {
  isResumeVersionType,
  ResumeVersionAccessError,
} from "./resume-version-permissions";

export type CreateResumeVersionShellInput = {
  userId: string;
  title: string;
  type?: ResumeVersionType;
  sourceResumeDocumentId?: string | null;
  sourceResumeAnalysisId?: string | null;
  targetJobId?: string | null;
  targetJobAnalysisId?: string | null;
  alignmentScoreBefore?: number | null;
  alignmentScoreAfter?: number | null;
};

export async function createResumeVersionShell(input: CreateResumeVersionShellInput) {
  const title = input.title.trim();
  if (!title) {
    throw new ResumeVersionAccessError("INVALID_INPUT", "Resume version title is required.");
  }

  const type = input.type ?? "JOB_SPECIFIC";
  if (!isResumeVersionType(type)) {
    throw new ResumeVersionAccessError("INVALID_INPUT", "Invalid resume version type.");
  }

  if (input.sourceResumeDocumentId) {
    const sourceDocument = await prisma.resumeDocument.findFirst({
      where: { id: input.sourceResumeDocumentId, userId: input.userId },
      select: { id: true },
    });
    if (!sourceDocument) {
      throw new ResumeVersionAccessError(
        "INVALID_INPUT",
        "Source resume document not found for this user.",
      );
    }
  }

  if (input.sourceResumeAnalysisId) {
    const sourceAnalysis = await prisma.resumeAnalysis.findFirst({
      where: {
        id: input.sourceResumeAnalysisId,
        resumeDocument: { userId: input.userId },
      },
      select: { id: true, resumeDocumentId: true },
    });
    if (!sourceAnalysis) {
      throw new ResumeVersionAccessError(
        "INVALID_INPUT",
        "Source resume analysis not found for this user.",
      );
    }
    if (
      input.sourceResumeDocumentId &&
      sourceAnalysis.resumeDocumentId !== input.sourceResumeDocumentId
    ) {
      throw new ResumeVersionAccessError(
        "INVALID_INPUT",
        "Source resume analysis does not belong to the provided source resume document.",
      );
    }
  }

  if (input.targetJobId) {
    const targetJob = await prisma.jobPosting.findFirst({
      where: { id: input.targetJobId, userId: input.userId },
      select: { id: true },
    });
    if (!targetJob) {
      throw new ResumeVersionAccessError(
        "INVALID_INPUT",
        "Target job not found for this user.",
      );
    }
  }

  if (input.targetJobAnalysisId) {
    const targetJobAnalysis = await prisma.jobAnalysis.findFirst({
      where: {
        id: input.targetJobAnalysisId,
        jobPosting: { userId: input.userId },
      },
      select: { id: true, jobPostingId: true },
    });
    if (!targetJobAnalysis) {
      throw new ResumeVersionAccessError(
        "INVALID_INPUT",
        "Target job analysis not found for this user.",
      );
    }
    if (input.targetJobId && targetJobAnalysis.jobPostingId !== input.targetJobId) {
      throw new ResumeVersionAccessError(
        "INVALID_INPUT",
        "Target job analysis does not belong to the provided target job.",
      );
    }
  }

  return prisma.resumeVersion.create({
    data: {
      userId: input.userId,
      title,
      type,
      status: "DRAFT",
      sourceResumeDocumentId: input.sourceResumeDocumentId ?? null,
      sourceResumeAnalysisId: input.sourceResumeAnalysisId ?? null,
      targetJobId: input.targetJobId ?? null,
      targetJobAnalysisId: input.targetJobAnalysisId ?? null,
      alignmentScoreBefore: input.alignmentScoreBefore ?? null,
      alignmentScoreAfter: input.alignmentScoreAfter ?? null,
    },
  });
}
