import { rebuildCurrentContextForDraft } from "./build-communication-context";
import {
  buildCommunicationContextFingerprint,
  toCommunicationContextSnapshot,
} from "./communication-context-fingerprint";
import { assertCommunicationDraftOwnedByUser, CommunicationAccessError } from "./communication-permissions";
import { createCommunicationRevision } from "./create-communication-revision";
import { resolveCommunication } from "../ai/resolve-communication";
import type { CommunicationGenerationInput } from "../types";
import {
  isCommunicationLanguage,
  isCommunicationLength,
  isCommunicationTone,
  isOfferResponseIntent,
} from "./communication-permissions";

export async function regenerateCommunication(
  userId: string,
  draftId: string,
  overrides?: unknown,
) {
  const draft = await assertCommunicationDraftOwnedByUser(userId, draftId);
  const record = (overrides ?? {}) as Record<string, unknown>;

  const current = await rebuildCurrentContextForDraft(userId, draftId);
  const context = {
    ...current,
    settings: {
      ...current.settings,
      tone: isCommunicationTone(record.tone) ? record.tone : current.settings.tone,
      length: isCommunicationLength(record.length) ? record.length : current.settings.length,
      language: isCommunicationLanguage(record.language)
        ? record.language
        : current.settings.language,
      offerIntent: isOfferResponseIntent(record.offerIntent)
        ? record.offerIntent
        : current.settings.offerIntent,
    },
  };

  const resolved = await resolveCommunication(context);
  const fingerprint = buildCommunicationContextFingerprint(context);
  const snapshot = toCommunicationContextSnapshot(context);

  const content = resolved.output.content.trim();
  if (!content) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "Regeneration did not produce usable content. The previous revision is unchanged.",
    );
  }

  const revision = await createCommunicationRevision({
    userId,
    communicationDraftId: draft.id,
    source: resolved.source,
    subject: resolved.output.subject,
    content,
    tone: context.settings.tone,
    length: context.settings.length,
    language: context.settings.language,
    contextSnapshot: snapshot,
    contextFingerprint: fingerprint,
    evidenceUsed: resolved.output.evidenceUsed,
    warnings: resolved.output.warnings,
    changeLog: [
      ...resolved.output.changeLog,
      { action: "REGENERATE", detail: "Regenerated with current CareerOS context." },
    ],
    model: resolved.model,
    aiSource: resolved.aiSource,
    generationStatus: "COMPLETED",
  });

  return {
    draftId: draft.id,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    source: resolved.source,
    message: "A new revision was generated from the latest context.",
  };
}

export type { CommunicationGenerationInput };
