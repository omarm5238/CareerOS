import { prisma } from "@/server/db/prisma";

import type {
  ResumeVersionGenerationStatus,
  ResumeVersionRevisionSource,
  ResumeVersionStatus,
  ResumeVersionType,
} from "@/generated/prisma/client";

export class ResumeVersionAccessError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT";

  constructor(code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT", message: string) {
    super(message);
    this.name = "ResumeVersionAccessError";
    this.code = code;
  }
}

const ACCESS_ERROR_STATUS: Record<ResumeVersionAccessError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
};

/** Maps an ownership/validation failure onto an HTTP response shape. */
export function toResumeVersionErrorResponse(
  error: unknown,
): { status: number; message: string } | null {
  if (!(error instanceof ResumeVersionAccessError)) return null;
  return { status: ACCESS_ERROR_STATUS[error.code], message: error.message };
}

export const RESUME_VERSION_STATUSES = [
  "DRAFT",
  "READY",
  "USED",
  "ARCHIVED",
] as const satisfies readonly ResumeVersionStatus[];

export const RESUME_VERSION_TYPES = [
  "JOB_SPECIFIC",
  "ROLE_BASED",
  "GENERAL",
] as const satisfies readonly ResumeVersionType[];

export const RESUME_VERSION_REVISION_SOURCES = [
  "AI_GENERATED",
  "USER_EDITED",
  "RULE_BASED_FALLBACK",
  "IMPORTED",
] as const satisfies readonly ResumeVersionRevisionSource[];

export const RESUME_VERSION_GENERATION_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
] as const satisfies readonly ResumeVersionGenerationStatus[];

export function isResumeVersionStatus(value: unknown): value is ResumeVersionStatus {
  return (
    typeof value === "string" &&
    (RESUME_VERSION_STATUSES as readonly string[]).includes(value)
  );
}

export function isResumeVersionType(value: unknown): value is ResumeVersionType {
  return typeof value === "string" && (RESUME_VERSION_TYPES as readonly string[]).includes(value);
}

export function isResumeVersionRevisionSource(
  value: unknown,
): value is ResumeVersionRevisionSource {
  return (
    typeof value === "string" &&
    (RESUME_VERSION_REVISION_SOURCES as readonly string[]).includes(value)
  );
}

export function isResumeVersionGenerationStatus(
  value: unknown,
): value is ResumeVersionGenerationStatus {
  return (
    typeof value === "string" &&
    (RESUME_VERSION_GENERATION_STATUSES as readonly string[]).includes(value)
  );
}

export async function assertResumeVersionOwnedByUser(userId: string, versionId: string) {
  const version = await prisma.resumeVersion.findFirst({
    where: { id: versionId, userId },
    select: { id: true, userId: true, status: true, activeRevisionId: true },
  });

  if (!version) {
    throw new ResumeVersionAccessError(
      "NOT_FOUND",
      "Resume version not found for this user.",
    );
  }

  return version;
}

export async function assertResumeVersionRevisionOwnedByUser(
  userId: string,
  versionId: string,
  revisionId: string,
) {
  const revision = await prisma.resumeVersionRevision.findFirst({
    where: {
      id: revisionId,
      resumeVersionId: versionId,
      userId,
    },
    select: {
      id: true,
      resumeVersionId: true,
      userId: true,
      revisionNumber: true,
    },
  });

  if (!revision) {
    throw new ResumeVersionAccessError(
      "NOT_FOUND",
      "Resume version revision not found for this user.",
    );
  }

  return revision;
}
