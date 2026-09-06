import type { CommunicationGenerationInput } from "../types";
import {
  CommunicationAccessError,
  isCommunicationLanguage,
  isCommunicationLength,
  isCommunicationTone,
  isCommunicationType,
  isOfferResponseIntent,
  isRecipientMode,
} from "./communication-permissions";

function optionalId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseGenerationInput(body: unknown): CommunicationGenerationInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Invalid generation input.");
  }

  const record = body as Record<string, unknown>;
  if (!isCommunicationType(record.type)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Choose a communication type.");
  }

  const recipientMode = record.recipientMode ?? "UNKNOWN";
  if (!isRecipientMode(recipientMode)) {
    throw new CommunicationAccessError("INVALID_INPUT", "Choose a valid recipient.");
  }

  return {
    applicationId: optionalId(record.applicationId),
    jobPostingId: optionalId(record.jobPostingId),
    contactId: optionalId(record.contactId),
    resumeVersionId: optionalId(record.resumeVersionId),
    resumeVersionRevisionId: optionalId(record.resumeVersionRevisionId),
    recipientMode,
    type: record.type,
    tone: isCommunicationTone(record.tone) ? record.tone : "PROFESSIONAL",
    length: isCommunicationLength(record.length) ? record.length : undefined,
    language: isCommunicationLanguage(record.language) ? record.language : "ENGLISH",
    offerIntent: isOfferResponseIntent(record.offerIntent) ? record.offerIntent : null,
    interviewOccurredConfirmed: record.interviewOccurredConfirmed === true,
  };
}
