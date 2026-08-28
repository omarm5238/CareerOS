import { prisma } from "@/server/db/prisma";

import type {
  ApplicationEventType,
  ApplicationInsightType,
  ApplicationNextActionType,
  ApplicationRejectionSource,
  ApplicationStatus,
} from "@/generated/prisma/client";

export class ApplicationAccessError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT";

  constructor(
    code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "ApplicationAccessError";
    this.code = code;
  }
}

const ACCESS_ERROR_STATUS: Record<ApplicationAccessError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  CONFLICT: 409,
};

export function toApplicationErrorResponse(
  error: unknown,
): { status: number; message: string } | null {
  if (!(error instanceof ApplicationAccessError)) return null;
  return { status: ACCESS_ERROR_STATUS[error.code], message: error.message };
}

export const APPLICATION_STATUSES = [
  "DRAFT",
  "APPLIED",
  "SCREENING",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
] as const satisfies readonly ApplicationStatus[];

export const APPLICATION_REJECTION_SOURCES = [
  "EMPLOYER_STATED",
  "USER_CONFIRMED_FACT",
  "OTHER_CONFIRMED",
] as const satisfies readonly ApplicationRejectionSource[];

export const APPLICATION_NEXT_ACTION_TYPES = [
  "SUBMIT_APPLICATION",
  "FOLLOW_UP",
  "CONTACT_RECRUITER",
  "PREPARE_SCREENING",
  "PREPARE_ASSESSMENT",
  "PREPARE_INTERVIEW",
  "REVIEW_OFFER",
  "PROVIDE_DOCUMENTS",
  "UPDATE_RESUME",
  "BUILD_SKILL",
  "WAIT",
  "REVIEW_REJECTION",
  "OTHER",
] as const satisfies readonly ApplicationNextActionType[];

export const APPLICATION_INSIGHT_TYPES = [
  "NEXT_ACTION",
  "SCREENING_PREP",
  "ASSESSMENT_PREP",
  "INTERVIEW_PREP",
  "OFFER_REVIEW",
  "REJECTION_ANALYSIS",
] as const satisfies readonly ApplicationInsightType[];

/**
 * Event types a user may record manually. Status-bearing types such as
 * STATUS_CHANGED and SUBMITTED are deliberately excluded so the generic event
 * endpoint can never mutate application status.
 */
export const MANUAL_APPLICATION_EVENT_TYPES = [
  "SCREENING_SCHEDULED",
  "SCREENING_COMPLETED",
  "ASSESSMENT_RECEIVED",
  "ASSESSMENT_SCHEDULED",
  "ASSESSMENT_COMPLETED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "OFFER_RECEIVED",
  "FOLLOW_UP_SENT",
  "NOTE_ADDED",
  "OTHER",
] as const satisfies readonly ApplicationEventType[];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function isApplicationRejectionSource(
  value: unknown,
): value is ApplicationRejectionSource {
  return (
    typeof value === "string" &&
    (APPLICATION_REJECTION_SOURCES as readonly string[]).includes(value)
  );
}

export function isManualApplicationEventType(value: unknown): value is ApplicationEventType {
  return (
    typeof value === "string" &&
    (MANUAL_APPLICATION_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function isApplicationInsightType(value: unknown): value is ApplicationInsightType {
  return (
    typeof value === "string" && (APPLICATION_INSIGHT_TYPES as readonly string[]).includes(value)
  );
}

/** Loads an application scoped to the owner. Never reveals other users' IDs. */
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
      followUpAt: true,
      closedAt: true,
    },
  });

  if (!application) {
    throw new ApplicationAccessError("NOT_FOUND", "Application not found for this user.");
  }

  return application;
}

export async function assertJobOwnedByUser(userId: string, jobPostingId: string) {
  const job = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, userId },
    select: { id: true },
  });

  if (!job) {
    throw new ApplicationAccessError("NOT_FOUND", "Job not found for this user.");
  }

  return job;
}

/**
 * Verifies a resume link belongs to the user and that the revision really
 * belongs to the given version. Returns the resolved pair for snapshotting.
 */
export async function assertResumeLinkOwnedByUser(
  userId: string,
  resumeVersionId: string,
  resumeVersionRevisionId?: string | null,
) {
  const version = await prisma.resumeVersion.findFirst({
    where: { id: resumeVersionId, userId },
    select: {
      id: true,
      title: true,
      status: true,
      activeRevisionId: true,
    },
  });

  if (!version) {
    throw new ApplicationAccessError("NOT_FOUND", "Resume version not found for this user.");
  }

  const targetRevisionId = resumeVersionRevisionId ?? version.activeRevisionId;
  if (!targetRevisionId) {
    throw new ApplicationAccessError(
      "INVALID_INPUT",
      "That resume version has no revision to link yet.",
    );
  }

  const revision = await prisma.resumeVersionRevision.findFirst({
    where: { id: targetRevisionId, userId, resumeVersionId: version.id },
    select: {
      id: true,
      revisionNumber: true,
      alignmentScoreBefore: true,
      alignmentScoreAfter: true,
    },
  });

  if (!revision) {
    throw new ApplicationAccessError(
      "INVALID_INPUT",
      "That revision does not belong to the selected resume version.",
    );
  }

  return { version, revision };
}
