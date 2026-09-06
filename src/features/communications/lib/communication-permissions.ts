import { prisma } from "@/server/db/prisma";

import type {
  CommunicationGenerationStatus,
  CommunicationLanguage,
  CommunicationLength,
  CommunicationRevisionSource,
  CommunicationStatus,
  CommunicationTone,
  CommunicationType,
} from "@/generated/prisma/client";

import {
  COMMUNICATION_GENERATION_STATUSES,
  COMMUNICATION_LANGUAGES,
  COMMUNICATION_LENGTHS,
  COMMUNICATION_REVISION_SOURCES,
  COMMUNICATION_STATUSES,
  COMMUNICATION_TONES,
  COMMUNICATION_TRANSFORM_TYPES,
  COMMUNICATION_TYPES,
  OFFER_RESPONSE_INTENTS,
  RECIPIENT_MODES,
  type CommunicationTransformType,
  type OfferResponseIntent,
  type RecipientMode,
} from "../types";

export class CommunicationAccessError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT";

  constructor(
    code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "CommunicationAccessError";
    this.code = code;
  }
}

const ACCESS_ERROR_STATUS: Record<CommunicationAccessError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  CONFLICT: 409,
};

export function toCommunicationErrorResponse(
  error: unknown,
): { status: number; message: string } | null {
  if (!(error instanceof CommunicationAccessError)) return null;
  return { status: ACCESS_ERROR_STATUS[error.code], message: error.message };
}

export function isCommunicationType(value: unknown): value is CommunicationType {
  return typeof value === "string" && (COMMUNICATION_TYPES as readonly string[]).includes(value);
}

export function isCommunicationStatus(value: unknown): value is CommunicationStatus {
  return typeof value === "string" && (COMMUNICATION_STATUSES as readonly string[]).includes(value);
}

export function isCommunicationTone(value: unknown): value is CommunicationTone {
  return typeof value === "string" && (COMMUNICATION_TONES as readonly string[]).includes(value);
}

export function isCommunicationLength(value: unknown): value is CommunicationLength {
  return typeof value === "string" && (COMMUNICATION_LENGTHS as readonly string[]).includes(value);
}

export function isCommunicationLanguage(value: unknown): value is CommunicationLanguage {
  return typeof value === "string" && (COMMUNICATION_LANGUAGES as readonly string[]).includes(value);
}

export function isCommunicationRevisionSource(
  value: unknown,
): value is CommunicationRevisionSource {
  return (
    typeof value === "string" &&
    (COMMUNICATION_REVISION_SOURCES as readonly string[]).includes(value)
  );
}

export function isCommunicationGenerationStatus(
  value: unknown,
): value is CommunicationGenerationStatus {
  return (
    typeof value === "string" &&
    (COMMUNICATION_GENERATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isOfferResponseIntent(value: unknown): value is OfferResponseIntent {
  return typeof value === "string" && (OFFER_RESPONSE_INTENTS as readonly string[]).includes(value);
}

export function isRecipientMode(value: unknown): value is RecipientMode {
  return typeof value === "string" && (RECIPIENT_MODES as readonly string[]).includes(value);
}

export function isCommunicationTransformType(value: unknown): value is CommunicationTransformType {
  return (
    typeof value === "string" &&
    (COMMUNICATION_TRANSFORM_TYPES as readonly string[]).includes(value)
  );
}

export async function assertCommunicationDraftOwnedByUser(userId: string, draftId: string) {
  const draft = await prisma.communicationDraft.findFirst({
    where: { id: draftId, userId },
    select: {
      id: true,
      userId: true,
      applicationId: true,
      jobPostingId: true,
      contactId: true,
      resumeVersionId: true,
      resumeVersionRevisionId: true,
      type: true,
      status: true,
      activeRevisionId: true,
      usedAt: true,
      archivedAt: true,
    },
  });

  if (!draft) {
    throw new CommunicationAccessError("NOT_FOUND", "Communication draft not found.");
  }

  return draft;
}

export async function assertCommunicationRevisionOwnedByUser(
  userId: string,
  revisionId: string,
  draftId: string,
) {
  const revision = await prisma.communicationDraftRevision.findFirst({
    where: { id: revisionId, userId, communicationDraftId: draftId },
    select: {
      id: true,
      userId: true,
      communicationDraftId: true,
      revisionNumber: true,
      source: true,
      subject: true,
      content: true,
      tone: true,
      length: true,
      language: true,
      contextSnapshotJson: true,
      contextFingerprint: true,
      generationStatus: true,
    },
  });

  if (!revision) {
    throw new CommunicationAccessError("NOT_FOUND", "Communication revision not found.");
  }

  return revision;
}

export async function assertJobOwnedByUser(userId: string, jobPostingId: string) {
  const job = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, userId },
    select: { id: true, title: true, company: true, location: true, source: true },
  });

  if (!job) {
    throw new CommunicationAccessError("NOT_FOUND", "Job not found for this user.");
  }

  return job;
}

export async function assertApplicationOwnedByUser(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: {
      id: true,
      userId: true,
      status: true,
      jobPostingId: true,
      resumeVersionId: true,
      resumeVersionRevisionId: true,
      appliedAt: true,
    },
  });

  if (!application) {
    throw new CommunicationAccessError("NOT_FOUND", "Application not found for this user.");
  }

  return application;
}

export async function assertContactOwnedForApplication(
  userId: string,
  contactId: string,
  applicationId: string | null,
) {
  const contact = await prisma.applicationContact.findFirst({
    where: { id: contactId, userId },
    select: {
      id: true,
      applicationId: true,
      name: true,
      role: true,
      company: true,
      email: true,
      isPrimary: true,
    },
  });

  if (!contact) {
    throw new CommunicationAccessError("NOT_FOUND", "Contact not found for this user.");
  }

  if (applicationId && contact.applicationId !== applicationId) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "That contact does not belong to this application.",
    );
  }

  return contact;
}

export async function assertResumeRevisionOwnedByUser(
  userId: string,
  resumeVersionId: string,
  resumeVersionRevisionId: string,
) {
  const version = await prisma.resumeVersion.findFirst({
    where: { id: resumeVersionId, userId },
    select: { id: true, title: true, status: true, activeRevisionId: true },
  });

  if (!version) {
    throw new CommunicationAccessError("NOT_FOUND", "Resume version not found for this user.");
  }

  const revision = await prisma.resumeVersionRevision.findFirst({
    where: {
      id: resumeVersionRevisionId,
      userId,
      resumeVersionId: version.id,
    },
    select: {
      id: true,
      revisionNumber: true,
      alignmentScoreAfter: true,
      contentJson: true,
    },
  });

  if (!revision) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "That revision does not belong to the selected resume version.",
    );
  }

  return { version, revision };
}
