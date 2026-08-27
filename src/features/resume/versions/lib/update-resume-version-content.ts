import { prisma } from "@/server/db/prisma";

import { EMPTY_RESUME_VERSION_CONTENT } from "../types";
import type { ResumeVersionChangeLogItem } from "../types";
import { createResumeVersionRevision } from "./create-resume-version-revision";
import {
  parseChangeLog,
  parseEvidenceNotes,
  parseInputSnapshot,
  parseKeywordCoverage,
  parseResumeVersionContent,
  parseWarnings,
} from "./json-parsers";
import { assertResumeVersionOwnedByUser } from "./resume-version-permissions";
import {
  diffResumeVersionContent,
  validateResumeVersionContent,
} from "./validate-resume-version-content";

export type UpdateResumeVersionContentResult =
  | {
      ok: true;
      revisionId: string;
      revisionNumber: number;
      message: string;
    }
  | { ok: false; status: number; message: string; field?: string };

const MAX_CHANGE_LOG_ITEMS = 12;

export async function updateResumeVersionContent(
  userId: string,
  versionId: string,
  body: unknown,
): Promise<UpdateResumeVersionContentResult> {
  await assertResumeVersionOwnedByUser(userId, versionId);

  const version = await prisma.resumeVersion.findFirst({
    where: { id: versionId, userId },
    select: {
      id: true,
      status: true,
      activeRevision: {
        select: {
          contentJson: true,
          keywordCoverageJson: true,
          warningsJson: true,
          changeLogJson: true,
          evidenceNotesJson: true,
          inputSnapshotJson: true,
          alignmentScoreBefore: true,
          alignmentScoreAfter: true,
          model: true,
          aiSource: true,
        },
      },
    },
  });

  if (!version) {
    return { ok: false, status: 404, message: "Resume version not found." };
  }

  if (version.status === "ARCHIVED") {
    return {
      ok: false,
      status: 400,
      message: "This version is archived. Restore it to Draft before editing.",
    };
  }

  const active = version.activeRevision;
  const previousContent = active
    ? parseResumeVersionContent(active.contentJson)
    : { ...EMPTY_RESUME_VERSION_CONTENT };

  const validation = validateResumeVersionContent(body, previousContent);
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      message: validation.message,
      field: validation.field,
    };
  }

  const changedSections = diffResumeVersionContent(previousContent, validation.data);

  if (changedSections.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "No changes to save.",
    };
  }

  const manualEntries: ResumeVersionChangeLogItem[] = changedSections.map((section) => ({
    section,
    change: "Edited manually.",
    reason: "Manual edit by you.",
  }));

  const changeLog = [
    ...manualEntries,
    ...(active ? parseChangeLog(active.changeLogJson) : []),
  ].slice(0, MAX_CHANGE_LOG_ITEMS);

  const revision = await createResumeVersionRevision({
    userId,
    resumeVersionId: versionId,
    source: "USER_EDITED",
    content: validation.data,
    keywordCoverage: active ? parseKeywordCoverage(active.keywordCoverageJson) : [],
    warnings: active ? parseWarnings(active.warningsJson) : [],
    changeLog,
    evidenceNotes: active ? parseEvidenceNotes(active.evidenceNotesJson) : [],
    inputSnapshot: active ? parseInputSnapshot(active.inputSnapshotJson) : undefined,
    alignmentScoreBefore: active?.alignmentScoreBefore ?? null,
    alignmentScoreAfter: active?.alignmentScoreAfter ?? null,
    model: active?.model ?? null,
    aiSource: active?.aiSource ?? null,
    generationStatus: "COMPLETED",
    setAsActive: true,
  });

  return {
    ok: true,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    message: `Saved as revision ${revision.revisionNumber}. Earlier revisions are preserved.`,
  };
}
