import { prisma } from "@/server/db/prisma";

import type { CommunicationContext, CommunicationGenerationOutput } from "../types";
import { activateCommunicationRevision } from "./activate-communication-revision";
import {
  buildCommunicationContextFingerprint,
  toCommunicationContextSnapshot,
} from "./communication-context-fingerprint";
import { CommunicationAccessError } from "./communication-permissions";
import { peekGenerationLock, setGenerationLock } from "./generation-lock";
import { toPrismaJson } from "./json-parsers";

export type PersistGeneratedDraftInput = {
  userId: string;
  context: CommunicationContext;
  output: CommunicationGenerationOutput;
  source: "AI_GENERATED" | "RULE_BASED_FALLBACK";
  model: string | null;
  aiSource: string;
  reuseFingerprint?: boolean;
};

export async function persistGeneratedDraft(input: PersistGeneratedDraftInput) {
  const fingerprint = buildCommunicationContextFingerprint(input.context);
  const snapshot = toCommunicationContextSnapshot(input.context);

  if (input.reuseFingerprint !== false) {
    const existingId = peekGenerationLock(input.userId, fingerprint);
    if (existingId) {
      const existing = await prisma.communicationDraft.findFirst({
        where: { id: existingId, userId: input.userId },
        select: { id: true },
      });
      if (existing) {
        return { draftId: existing.id, reused: true as const };
      }
    }
  }

  const content = input.output.content.trim();
  if (!content) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "Generation did not produce usable message content.",
    );
  }

  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.communicationDraft.create({
      data: {
        userId: input.userId,
        applicationId: input.context.application?.id ?? null,
        jobPostingId: input.context.job.id,
        contactId: input.context.contact.id,
        resumeVersionId: input.context.resume.versionId,
        resumeVersionRevisionId: input.context.resume.revisionId,
        type: input.context.settings.type,
        status: "DRAFT",
      },
    });

    const revision = await tx.communicationDraftRevision.create({
      data: {
        communicationDraftId: created.id,
        userId: input.userId,
        revisionNumber: 1,
        source: input.source,
        subject: input.output.subject,
        content,
        tone: input.context.settings.tone,
        length: input.context.settings.length,
        language: input.context.settings.language,
        contextSnapshotJson: toPrismaJson(snapshot),
        contextFingerprint: fingerprint,
        evidenceUsedJson: toPrismaJson(input.output.evidenceUsed),
        warningsJson: toPrismaJson(input.output.warnings),
        changeLogJson: toPrismaJson(input.output.changeLog),
        model: input.model,
        aiSource: input.aiSource,
        generationStatus: "COMPLETED",
      },
    });

    await activateCommunicationRevision(tx, created.id, input.userId, revision);
    return created;
  });

  setGenerationLock(input.userId, fingerprint, draft.id);
  return { draftId: draft.id, reused: false as const };
}
