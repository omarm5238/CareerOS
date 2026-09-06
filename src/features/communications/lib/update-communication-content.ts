import { assertCommunicationDraftOwnedByUser, CommunicationAccessError } from "./communication-permissions";
import { createCommunicationRevision } from "./create-communication-revision";
import { getCommunicationDraftDetailForUser } from "./get-communication-draft-detail";
import { clipMultiline, clipText } from "./json-parsers";

const SUBJECT_MAX = 180;
const CONTENT_MAX = 4_000;

export async function updateCommunicationContent(
  userId: string,
  draftId: string,
  input: unknown,
) {
  const draft = await assertCommunicationDraftOwnedByUser(userId, draftId);

  if (!draft.activeRevisionId) {
    throw new CommunicationAccessError("INVALID_INPUT", "This draft has no active revision to edit.");
  }

  const record = (input ?? {}) as Record<string, unknown>;
  const subjectRaw = typeof record.subject === "string" ? record.subject : "";
  const contentRaw = typeof record.content === "string" ? record.content : "";
  const subject = clipText(subjectRaw, SUBJECT_MAX) || null;
  const content = clipMultiline(contentRaw, CONTENT_MAX);

  if (!content) {
    throw new CommunicationAccessError("INVALID_INPUT", "Message content cannot be empty.");
  }

  const current = await getCommunicationDraftDetailForUser(userId, draftId);
  const active = current?.activeRevision;
  if (!active) {
    throw new CommunicationAccessError("INVALID_INPUT", "This draft has no active revision to edit.");
  }

  const revision = await createCommunicationRevision({
    userId,
    communicationDraftId: draftId,
    source: "USER_EDITED",
    subject,
    content,
    tone: active.tone,
    length: active.length,
    language: active.language,
    contextSnapshot: active.contextSnapshot,
    contextFingerprint: active.contextFingerprint,
    evidenceUsed: active.evidenceUsed,
    warnings: active.warnings,
    changeLog: [{ action: "USER_EDIT", detail: "Manual edit of subject or body." }],
    model: null,
    aiSource: "user",
    generationStatus: "COMPLETED",
  });

  return {
    draftId,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    message: "Changes saved as a new revision.",
  };
}
