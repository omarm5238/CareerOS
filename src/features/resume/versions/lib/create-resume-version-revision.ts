import { prisma } from "@/server/db/prisma";

import type {
  ResumeVersionGenerationStatus,
  ResumeVersionRevisionSource,
} from "@/generated/prisma/client";

import type {
  ResumeVersionChangeLogItem,
  ResumeVersionContent,
  ResumeVersionEvidenceNote,
  ResumeVersionInputSnapshot,
  ResumeVersionKeywordCoverageItem,
  ResumeVersionWarning,
} from "../types";
import { EMPTY_RESUME_VERSION_CONTENT, EMPTY_RESUME_VERSION_INPUT_SNAPSHOT } from "../types";
import { activateResumeVersionRevision } from "./activate-resume-version-revision";
import { toPrismaJson } from "./json-parsers";
import {
  assertResumeVersionOwnedByUser,
  isResumeVersionGenerationStatus,
  isResumeVersionRevisionSource,
  ResumeVersionAccessError,
} from "./resume-version-permissions";

export type CreateResumeVersionRevisionInput = {
  userId: string;
  resumeVersionId: string;
  source: ResumeVersionRevisionSource;
  content?: ResumeVersionContent;
  keywordCoverage?: ResumeVersionKeywordCoverageItem[];
  warnings?: ResumeVersionWarning[];
  changeLog?: ResumeVersionChangeLogItem[];
  evidenceNotes?: ResumeVersionEvidenceNote[];
  inputSnapshot?: ResumeVersionInputSnapshot;
  alignmentScoreBefore?: number | null;
  alignmentScoreAfter?: number | null;
  model?: string | null;
  aiSource?: string | null;
  generationStatus?: ResumeVersionGenerationStatus;
  errorMessage?: string | null;
  setAsActive?: boolean;
};

export async function createResumeVersionRevision(input: CreateResumeVersionRevisionInput) {
  await assertResumeVersionOwnedByUser(input.userId, input.resumeVersionId);

  if (!isResumeVersionRevisionSource(input.source)) {
    throw new ResumeVersionAccessError("INVALID_INPUT", "Invalid revision source.");
  }

  const generationStatus = input.generationStatus ?? "COMPLETED";
  if (!isResumeVersionGenerationStatus(generationStatus)) {
    throw new ResumeVersionAccessError("INVALID_INPUT", "Invalid generation status.");
  }

  return prisma.$transaction(async (tx) => {
    const latest = await tx.resumeVersionRevision.findFirst({
      where: { resumeVersionId: input.resumeVersionId },
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    });

    const revisionNumber = (latest?.revisionNumber ?? 0) + 1;

    const revision = await tx.resumeVersionRevision.create({
      data: {
        resumeVersionId: input.resumeVersionId,
        userId: input.userId,
        revisionNumber,
        source: input.source,
        contentJson: toPrismaJson(input.content ?? EMPTY_RESUME_VERSION_CONTENT),
        keywordCoverageJson: toPrismaJson(input.keywordCoverage ?? []),
        warningsJson: toPrismaJson(input.warnings ?? []),
        changeLogJson: toPrismaJson(input.changeLog ?? []),
        evidenceNotesJson: toPrismaJson(input.evidenceNotes ?? []),
        inputSnapshotJson: toPrismaJson(
          input.inputSnapshot ?? EMPTY_RESUME_VERSION_INPUT_SNAPSHOT,
        ),
        alignmentScoreBefore: input.alignmentScoreBefore ?? null,
        alignmentScoreAfter: input.alignmentScoreAfter ?? null,
        model: input.model ?? null,
        aiSource: input.aiSource ?? null,
        generationStatus,
        errorMessage: input.errorMessage ?? null,
      },
    });

    if (input.setAsActive !== false) {
      await activateResumeVersionRevision(tx, input.resumeVersionId, revision);
    }

    return revision;
  });
}
