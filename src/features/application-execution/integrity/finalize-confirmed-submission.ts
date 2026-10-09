import { Prisma } from "@/generated/prisma/client";

import { recordApplicationEvent } from "@/features/applications/lib/create-application-event";
import { syncLegacyJobApplicationFields } from "@/features/applications/lib/legacy-application-compatibility";
import { toPrismaJson as applicationJson } from "@/features/applications/lib/json-parsers";
import { prisma } from "@/server/db/prisma";

import { toPrismaJson } from "../lib/json-parsers";

export const FINALIZER_FAULT_POINTS = [
  "AFTER_ATTEMPT",
  "AFTER_SESSION",
  "AFTER_PACKAGE",
  "AFTER_APPLICATION",
  "AFTER_APPLICATION_EVENT",
  "AFTER_EXECUTION_EVENT",
] as const;

export type FinalizerFaultPoint = (typeof FINALIZER_FAULT_POINTS)[number];

export type FinalizeResult =
  | "FINALIZED"
  | "ALREADY_FINALIZED"
  | "CONFLICT"
  | "INVALID_CONFIRMATION"
  | "OWNERSHIP_DENIED";

export type FinalizeConfirmedSubmissionInput = {
  userId: string;
  submissionAttemptId: string;
  submissionPackageId?: string;
  applicationId?: string;
};

export type FinalizeOptions = {
  faultPoint?: FinalizerFaultPoint;
  /** Test-only. Retries the local transaction. Never contacts a provider. */
  serializationFailuresBeforeSuccess?: number;
};

export class FinalizerFault extends Error {
  constructor(readonly faultPoint: FinalizerFaultPoint) {
    super(`Finalizer fault ${faultPoint}`);
  }
}

class FinalizerConflict extends Error {}

type Evidence = Record<string, unknown>;

function evidenceOf(value: unknown): Evidence {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Evidence : {};
}

export function hasTrustedConfirmation(attempt: {
  status: string;
  verificationStatus: string;
  failureCode: string | null;
  confirmationType: string | null;
  verificationEvidenceJson: unknown;
}): boolean {
  if (attempt.status === "CANCELLED") return false;
  if (attempt.status === "FAILED" && attempt.failureCode === "SUBMISSION_REJECTED") return false;
  const evidence = evidenceOf(attempt.verificationEvidenceJson);
  if (evidence.trustedConfirmation === true || attempt.verificationStatus === "VERIFIED") return true;
  return attempt.status === "COMPLETED" && Boolean(attempt.confirmationType);
}

/**
 * Durable confirmation marker written BEFORE the finalizer transaction.
 * A crash inside finalization leaves this marker and rolls back tracker success.
 * Reconciliation can then finish locally without contacting the provider.
 */
export async function persistTrustedConfirmation(
  userId: string,
  submissionAttemptId: string,
  confirmation: { confirmationType: string; confirmationReference?: string | null; confirmationEvidence?: string | null },
): Promise<boolean> {
  const attempt = await prisma.applicationSubmissionAttempt.findFirst({
    where: { id: submissionAttemptId, userId },
    select: {
      id: true,
      status: true,
      failureCode: true,
      submitBoundaryCrossedAt: true,
      verificationEvidenceJson: true,
      confirmationType: true,
    },
  });
  if (!attempt?.submitBoundaryCrossedAt) return false;
  if (attempt.status === "CANCELLED") return false;
  if (attempt.status === "FAILED" && attempt.failureCode === "SUBMISSION_REJECTED") return false;
  const evidence = {
    ...evidenceOf(attempt.verificationEvidenceJson),
    trustedConfirmation: true,
    confirmationEvidence: confirmation.confirmationEvidence ?? confirmation.confirmationType,
  };
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attempt.id },
    data: {
      confirmationType: attempt.confirmationType ?? confirmation.confirmationType,
      providerApplicationId: confirmation.confirmationReference ?? undefined,
      verificationEvidenceJson: toPrismaJson(evidence),
    },
  });
  return true;
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2028");
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function finalizeConfirmedSubmission(
  input: FinalizeConfirmedSubmissionInput,
  options: FinalizeOptions = {},
): Promise<FinalizeResult> {
  let injectedFaults = options.serializationFailuresBeforeSuccess ?? 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          if (injectedFaults > 0) {
            injectedFaults -= 1;
            throw new Prisma.PrismaClientKnownRequestError(
              "write conflict or deadlock",
              { code: "P2034", clientVersion: "test" },
            );
          }
          return finalizeInside(tx, input, options.faultPoint);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (result === "FINALIZED") await recordTrackerSideEffects(input.userId, input.submissionAttemptId);
      return result;
    } catch (error) {
      if (error instanceof FinalizerConflict) return "CONFLICT";
      if (error instanceof FinalizerFault) throw error;
      if (isUniqueConflict(error) || isSerializationConflict(error)) {
        const current = await readFinalized(input);
        if (current === "ALREADY_FINALIZED") return current;
        if (isSerializationConflict(error) && attempt < 2) continue;
        return "CONFLICT";
      }
      throw error;
    }
  }
  return "CONFLICT";
}

async function recordTrackerSideEffects(userId: string, submissionAttemptId: string) {
  const row = await prisma.applicationSubmissionAttempt.findFirst({
    where: { id: submissionAttemptId, userId },
    select: { applicationId: true, application: { select: { appliedAt: true } } },
  });
  if (!row) return;
  try {
    const { tryRecordMeaningfulCareerActivity } = await import("@/features/daily-roadmap/activity/record-activity");
    await tryRecordMeaningfulCareerActivity({
      userId,
      activityType: "APPLICATION_SUBMITTED",
      fingerprint: `APPLICATION_SUBMITTED:${row.applicationId}:APPLIED`,
      sourceEntityType: "APPLICATION",
      sourceEntityId: row.applicationId,
      occurredAt: row.application.appliedAt ?? new Date(),
    });
    const { ingestCareerMemorySafe } = await import("@/features/career-memory/ingestion/refresh");
    await ingestCareerMemorySafe(userId, "EVENT_DRIVEN");
  } catch {
    // Tracker truth is already committed. A side-effect failure must not reopen the provider.
  }
}

async function readFinalized(input: FinalizeConfirmedSubmissionInput): Promise<FinalizeResult | null> {
  const row = await prisma.applicationSubmissionAttempt.findFirst({
    where: { id: input.submissionAttemptId, userId: input.userId },
    select: {
      id: true,
      status: true,
      verificationStatus: true,
      applicationPackageId: true,
      applicationId: true,
    },
  });
  if (!row) return "OWNERSHIP_DENIED";
  const application = await prisma.application.findUnique({
    where: { id: row.applicationId },
    select: { status: true, submittedPackageId: true, submittedExecutionAttemptId: true },
  });
  if (!application) return "OWNERSHIP_DENIED";
  if (
    row.status === "COMPLETED" &&
    row.verificationStatus === "VERIFIED" &&
    application.status === "APPLIED" &&
    application.submittedPackageId === row.applicationPackageId &&
    application.submittedExecutionAttemptId === row.id
  ) {
    return "ALREADY_FINALIZED";
  }
  return null;
}

async function finalizeInside(
  tx: Prisma.TransactionClient,
  input: FinalizeConfirmedSubmissionInput,
  faultPoint?: FinalizerFaultPoint,
): Promise<FinalizeResult> {
  const attempt = await tx.applicationSubmissionAttempt.findFirst({
    where: { id: input.submissionAttemptId },
  });
  if (!attempt || attempt.userId !== input.userId) return "OWNERSHIP_DENIED";
  const application = await tx.application.findUnique({ where: { id: attempt.applicationId } });
  const pack = await tx.applicationPackage.findUnique({ where: { id: attempt.applicationPackageId } });
  const session = await tx.applicationExecutionSession.findUnique({ where: { id: attempt.executionSessionId } });
  if (!application || !pack || !session) return "OWNERSHIP_DENIED";
  if (application.userId !== input.userId || pack.userId !== input.userId || session.userId !== input.userId) {
    return "OWNERSHIP_DENIED";
  }
  if (input.submissionPackageId && input.submissionPackageId !== attempt.applicationPackageId) return "CONFLICT";
  if (input.applicationId && input.applicationId !== attempt.applicationId) return "CONFLICT";
  if (application.jobPostingId && pack.jobPostingId && application.jobPostingId !== pack.jobPostingId) {
    return "CONFLICT";
  }
  if (!attempt.submitBoundaryCrossedAt) return "INVALID_CONFIRMATION";
  if (attempt.status === "CANCELLED") return "INVALID_CONFIRMATION";
  if (attempt.status === "FAILED" && attempt.failureCode === "SUBMISSION_REJECTED") return "INVALID_CONFIRMATION";
  if (!hasTrustedConfirmation(attempt)) return "INVALID_CONFIRMATION";
  const currentAttempt = attempt;
  if (application.submittedExecutionAttemptId && application.submittedExecutionAttemptId !== attempt.id) {
    return "CONFLICT";
  }
  if (application.submittedPackageId && application.submittedPackageId !== attempt.applicationPackageId) {
    return "CONFLICT";
  }

  const submittedEvents = await tx.applicationEvent.count({
    where: { applicationId: attempt.applicationId, type: "SUBMITTED" },
  });
  const completionEvents = await tx.applicationExecutionEvent.count({
    where: { executionSessionId: attempt.executionSessionId, type: "SESSION_COMPLETED" },
  });
  const already =
    currentAttempt.status === "COMPLETED" &&
    currentAttempt.verificationStatus === "VERIFIED" &&
    application.status === "APPLIED" &&
    application.submittedPackageId === attempt.applicationPackageId &&
    application.submittedExecutionAttemptId === attempt.id &&
    pack.status === "SUBMITTED" &&
    session.status === "SUBMITTED" &&
    submittedEvents === 1 &&
    completionEvents >= 1;
  if (already) return "ALREADY_FINALIZED";

  const now = new Date();
  await tx.applicationSubmissionAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "COMPLETED",
      verificationStatus: "VERIFIED",
      confirmationType: currentAttempt.confirmationType ?? "provider-confirmation",
      submittedAt: currentAttempt.submittedAt ?? now,
      verifiedAt: currentAttempt.verifiedAt ?? now,
    },
  });
  if (faultPoint === "AFTER_ATTEMPT") throw new FinalizerFault(faultPoint);

  await tx.applicationExecutionSession.update({
    where: { id: attempt.executionSessionId },
    data: { status: "SUBMITTED", completedAt: session.completedAt ?? now, lastActivityAt: now },
  });
  if (faultPoint === "AFTER_SESSION") throw new FinalizerFault(faultPoint);

  await tx.applicationPackage.update({
    where: { id: attempt.applicationPackageId },
    data: {
      status: "SUBMITTED",
      submittedAt: pack.submittedAt ?? now,
      lockedAt: pack.lockedAt ?? now,
    },
  });
  if (faultPoint === "AFTER_PACKAGE") throw new FinalizerFault(faultPoint);

  const applied = await tx.application.updateMany({
    where: {
      id: attempt.applicationId,
      userId: input.userId,
      OR: [
        { submittedExecutionAttemptId: null, submittedPackageId: null },
        { submittedExecutionAttemptId: attempt.id, submittedPackageId: attempt.applicationPackageId },
      ],
    },
    data: {
      status: "APPLIED",
      submittedPackageId: attempt.applicationPackageId,
      submittedExecutionAttemptId: attempt.id,
      resumeVersionId: pack.resumeVersionId,
      resumeVersionRevisionId: pack.resumeVersionRevisionId,
      appliedAt: application.appliedAt ?? now,
      lastActivityAt: now,
    },
  });
  if (applied.count !== 1) throw new FinalizerConflict();
  if (faultPoint === "AFTER_APPLICATION") throw new FinalizerFault(faultPoint);

  if (submittedEvents === 0) {
    await recordApplicationEvent(tx, {
      applicationId: attempt.applicationId,
      userId: input.userId,
      type: "STATUS_CHANGED",
      source: "SYSTEM",
      title: "Moved to Applied",
      fromStatus: application.status === "APPLIED" ? null : application.status,
      toStatus: "APPLIED",
      eventAt: now,
    });
    await recordApplicationEvent(tx, {
      applicationId: attempt.applicationId,
      userId: input.userId,
      type: "SUBMITTED",
      source: "SYSTEM",
      title: "Application submitted",
      description: "Submitted package recorded.",
      eventAt: application.appliedAt ?? now,
      metadata: {
        submissionPackageId: attempt.applicationPackageId,
        executionAttemptId: attempt.id,
        provider: session.provider,
      },
    });
  }
  if (faultPoint === "AFTER_APPLICATION_EVENT") throw new FinalizerFault(faultPoint);

  if (completionEvents === 0) {
    await tx.applicationExecutionEvent.create({
      data: {
        userId: input.userId,
        executionSessionId: attempt.executionSessionId,
        type: "SESSION_COMPLETED",
        message: "Provider confirmation recorded. Tracker marked APPLIED.",
        metadataJson: applicationJson({
          attemptId: attempt.id,
          packageId: attempt.applicationPackageId,
        }),
      },
    });
  }
  if (faultPoint === "AFTER_EXECUTION_EVENT") throw new FinalizerFault(faultPoint);

  if (pack.resumeVersionId) {
    const version = await tx.resumeVersion.findFirst({
      where: { id: pack.resumeVersionId, userId: input.userId },
      select: { status: true },
    });
    if (version && version.status !== "USED" && version.status !== "ARCHIVED") {
      await tx.resumeVersion.update({
        where: { id: pack.resumeVersionId },
        data: { status: "USED" },
      });
    }
  }
  await syncLegacyJobApplicationFields(tx, {
    userId: input.userId,
    jobPostingId: application.jobPostingId,
    status: "APPLIED",
    appliedAt: application.appliedAt ?? now,
  });
  return "FINALIZED";
}

export async function reconcileConfirmedSubmission(userId: string, submissionAttemptId: string): Promise<FinalizeResult> {
  const attempt = await prisma.applicationSubmissionAttempt.findFirst({
    where: { id: submissionAttemptId, userId },
    select: {
      id: true,
      status: true,
      verificationStatus: true,
      failureCode: true,
      confirmationType: true,
      submitBoundaryCrossedAt: true,
      verificationEvidenceJson: true,
      applicationPackageId: true,
      applicationId: true,
    },
  });
  if (!attempt) return "OWNERSHIP_DENIED";
  if (!hasTrustedConfirmation(attempt)) return "INVALID_CONFIRMATION";
  return finalizeConfirmedSubmission({
    userId,
    submissionAttemptId: attempt.id,
    submissionPackageId: attempt.applicationPackageId,
    applicationId: attempt.applicationId,
  });
}

export type RecoveryClass = "RETRYABLE_BEFORE_SUBMIT" | "RECONCILED" | "SUBMIT_UNCERTAIN" | "UNCHANGED";

/**
 * Explicit recovery when an attempt is reopened. It does not guess from a timer,
 * and it never contacts the provider.
 */
export async function recoverInterruptedSubmissionAttempt(userId: string, submissionAttemptId: string): Promise<RecoveryClass> {
  const attempt = await prisma.applicationSubmissionAttempt.findFirst({
    where: { id: submissionAttemptId, userId },
    select: {
      id: true,
      status: true,
      verificationStatus: true,
      failureCode: true,
      confirmationType: true,
      submitBoundaryCrossedAt: true,
      verificationEvidenceJson: true,
      executionSessionId: true,
    },
  });
  if (!attempt) return "UNCHANGED";
  if (!attempt.submitBoundaryCrossedAt) return "RETRYABLE_BEFORE_SUBMIT";
  if (hasTrustedConfirmation(attempt)) {
    const result = await reconcileConfirmedSubmission(userId, attempt.id);
    return result === "FINALIZED" || result === "ALREADY_FINALIZED" ? "RECONCILED" : "UNCHANGED";
  }
  if (attempt.status === "SUBMITTING" || attempt.status === "VERIFYING" || attempt.status === "APPROVAL_GRANTED") {
    await prisma.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "UNCERTAIN",
        verificationStatus: "UNVERIFIED",
        failureCode: "SUBMISSION_UNCERTAIN",
        failureMessage: "Submit boundary was crossed and provider confirmation was not durably recorded.",
      },
    });
    await prisma.applicationExecutionSession.update({
      where: { id: attempt.executionSessionId },
      data: { status: "INTERRUPTED", failureCode: "SUBMISSION_UNCERTAIN" },
    });
    return "SUBMIT_UNCERTAIN";
  }
  if (attempt.status === "UNCERTAIN") return "SUBMIT_UNCERTAIN";
  return "UNCHANGED";
}
