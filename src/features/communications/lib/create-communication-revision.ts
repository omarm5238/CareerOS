import { prisma } from "@/server/db/prisma";

import type {
  CommunicationGenerationStatus,
  CommunicationLanguage,
  CommunicationLength,
  CommunicationRevisionSource,
  CommunicationTone,
} from "@/generated/prisma/client";

import type {
  CommunicationChangeLogItem,
  CommunicationContextSnapshot,
  CommunicationEvidenceItem,
  CommunicationWarning,
} from "../types";
import { activateCommunicationRevision } from "./activate-communication-revision";
import {
  assertCommunicationDraftOwnedByUser,
  CommunicationAccessError,
  isCommunicationGenerationStatus,
  isCommunicationRevisionSource,
} from "./communication-permissions";
import { toPrismaJson } from "./json-parsers";

export type CreateCommunicationRevisionInput = {
  userId: string;
  communicationDraftId: string;
  source: CommunicationRevisionSource;
  subject?: string | null;
  content: string;
  tone: CommunicationTone;
  length: CommunicationLength;
  language: CommunicationLanguage;
  contextSnapshot: CommunicationContextSnapshot;
  contextFingerprint: string;
  evidenceUsed?: CommunicationEvidenceItem[];
  warnings?: CommunicationWarning[];
  changeLog?: CommunicationChangeLogItem[];
  model?: string | null;
  aiSource?: string | null;
  generationStatus?: CommunicationGenerationStatus;
  errorMessage?: string | null;
  setAsActive?: boolean;
};

export async function createCommunicationRevision(input: CreateCommunicationRevisionInput) {
  await assertCommunicationDraftOwnedByUser(input.userId, input.communicationDraftId);

  if (!isCommunicationRevisionSource(input.source)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Invalid revision source.");
  }

  const generationStatus = input.generationStatus ?? "COMPLETED";
  if (!isCommunicationGenerationStatus(generationStatus)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Invalid generation status.");
  }

  const content = input.content.trim();
  if (!content) {
    throw new CommunicationAccessError("INVALID_INPUT", "Message content cannot be empty.");
  }

  return prisma.$transaction(async (tx) => {
    const latest = await tx.communicationDraftRevision.findFirst({
      where: { communicationDraftId: input.communicationDraftId },
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    });

    const revisionNumber = (latest?.revisionNumber ?? 0) + 1;

    const revision = await tx.communicationDraftRevision.create({
      data: {
        communicationDraftId: input.communicationDraftId,
        userId: input.userId,
        revisionNumber,
        source: input.source,
        subject: input.subject?.trim() || null,
        content,
        tone: input.tone,
        length: input.length,
        language: input.language,
        contextSnapshotJson: toPrismaJson(input.contextSnapshot),
        contextFingerprint: input.contextFingerprint,
        evidenceUsedJson: toPrismaJson(input.evidenceUsed ?? []),
        warningsJson: toPrismaJson(input.warnings ?? []),
        changeLogJson: toPrismaJson(input.changeLog ?? []),
        model: input.model ?? null,
        aiSource: input.aiSource ?? null,
        generationStatus,
        errorMessage: input.errorMessage ?? null,
      },
    });

    if (input.setAsActive !== false) {
      await activateCommunicationRevision(tx, input.communicationDraftId, input.userId, revision);
    }

    return revision;
  });
}
