import { isAiConfigured, logAiFallback } from "@/server/ai";

import { rebuildCurrentContextForDraft } from "./build-communication-context";
import {
  buildCommunicationContextFingerprint,
  toCommunicationContextSnapshot,
} from "./communication-context-fingerprint";
import {
  assertCommunicationDraftOwnedByUser,
  CommunicationAccessError,
  isCommunicationTransformType,
} from "./communication-permissions";
import { createCommunicationRevision } from "./create-communication-revision";
import { getCommunicationDraftDetailForUser } from "./get-communication-draft-detail";
import { transformCommunicationWithAi } from "../ai/generate-communication";
import { COMMUNICATION_TRANSFORM_LABELS } from "../types";

export async function transformCommunication(
  userId: string,
  draftId: string,
  transformRaw: unknown,
) {
  if (!isCommunicationTransformType(transformRaw)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Choose a supported adjustment.");
  }

  const draft = await assertCommunicationDraftOwnedByUser(userId, draftId);
  const detail = await getCommunicationDraftDetailForUser(userId, draftId);
  const active = detail?.activeRevision;
  if (!active) {
    throw new CommunicationAccessError("INVALID_INPUT", "This draft has no active revision.");
  }

  const context = await rebuildCurrentContextForDraft(userId, draftId);

  if (!isAiConfigured()) {
    logAiFallback("communication-transform", {
      hasApiKey: false,
      model: "",
      reason: "missing_api_key",
    });
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "AI is unavailable, so this adjustment was not applied. The current revision is unchanged.",
    );
  }

  const outcome = await transformCommunicationWithAi(
    context,
    transformRaw,
    active.subject,
    active.content,
  );

  if (!outcome.success) {
    logAiFallback("communication-transform", outcome.diagnostic);
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "The adjustment could not be generated. The current revision is unchanged.",
    );
  }

  if (transformRaw === "SHORTER" && outcome.payload.content.length >= active.content.length) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "The shorter adjustment did not reduce the message. The current revision is unchanged.",
    );
  }

  const nextLength = transformRaw === "SHORTER" ? "SHORT" : active.length;
  const nextContext = {
    ...context,
    settings: {
      ...context.settings,
      length: nextLength,
    },
  };

  const revision = await createCommunicationRevision({
    userId,
    communicationDraftId: draft.id,
    source: "AI_GENERATED",
    subject: outcome.payload.subject,
    content: outcome.payload.content,
    tone: active.tone,
    length: nextLength,
    language: active.language,
    contextSnapshot: toCommunicationContextSnapshot(nextContext),
    contextFingerprint: buildCommunicationContextFingerprint(nextContext),
    evidenceUsed: outcome.payload.evidenceUsed.length > 0 ? outcome.payload.evidenceUsed : active.evidenceUsed,
    warnings: outcome.payload.warnings,
    changeLog: [
      {
        action: transformRaw,
        detail: `${COMMUNICATION_TRANSFORM_LABELS[transformRaw]} applied to the previous revision.`,
      },
      ...outcome.payload.changeLog,
    ],
    model: outcome.model,
    aiSource: "ai",
    generationStatus: "COMPLETED",
  });

  return {
    draftId: draft.id,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    message: `${COMMUNICATION_TRANSFORM_LABELS[transformRaw]} created a new revision.`,
  };
}
