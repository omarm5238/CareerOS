import { Prisma } from "@/generated/prisma/client";

import { submissionIdempotencyKey } from "@/features/application-packages/provenance/package-hash";
import { evaluateApplicationReadiness } from "@/features/application-packages/readiness/evaluate-application-readiness";
import { prisma } from "@/server/db/prisma";

import {
  finalizeConfirmedSubmission,
  persistTrustedConfirmation,
  FinalizerFault,
  type FinalizerFaultPoint,
} from "./finalize-confirmed-submission";

import { recordExecutionEvent } from "../sessions/execution-event";
import {
  assertDomainTransition,
  type ExecutionDomainState,
  type ProviderExecutionResult,
} from "./execution-domain";

const LOCAL_PROVIDER = "UNKNOWN";
const ACTIVE_ATTEMPT = ["APPROVAL_GRANTED", "SUBMITTING", "VERIFYING"] as const;

export type AcquireOutcome =
  | "ACQUIRED"
  | "ALREADY_EXECUTING"
  | "ALREADY_SUBMITTED"
  | "ALREADY_UNCERTAIN"
  | "REJECTED_NO_RETRY"
  | "BLOCKED";

export type AcquireResult = {
  outcome: AcquireOutcome;
  packageId: string;
  applicationId: string | null;
  sessionId: string | null;
  attemptId: string | null;
  blockers: string[];
  domain: ExecutionDomainState | null;
};

type AttemptRow = {
  id: string;
  status: "APPROVAL_GRANTED" | "SUBMITTING" | "VERIFYING" | "COMPLETED" | "FAILED" | "UNCERTAIN" | "CANCELLED";
  verificationStatus: "NOT_RUN" | "VERIFIED" | "PROBABLE" | "UNVERIFIED" | "FAILED";
  submitBoundaryCrossedAt: Date | null;
  executionSessionId: string;
  applicationId: string;
  applicationPackageId: string;
};

function classifyExisting(attempt: AttemptRow): AcquireOutcome | null {
  if (attempt.status === "COMPLETED" && attempt.verificationStatus === "VERIFIED") return "ALREADY_SUBMITTED";
  if (attempt.status === "UNCERTAIN") return "ALREADY_UNCERTAIN";
  if (attempt.status === "FAILED" && attempt.submitBoundaryCrossedAt) return "REJECTED_NO_RETRY";
  if (ACTIVE_ATTEMPT.includes(attempt.status as (typeof ACTIVE_ATTEMPT)[number])) return "ALREADY_EXECUTING";
  return null;
}

/**
 * One package and one provider share one idempotency key.
 * A second caller receives the existing attempt instead of a second submit authority.
 * Safe retry reopens the same attempt only when the submit boundary was never crossed.
 */
export async function acquirePackageExecution(userId: string, packageId: string): Promise<AcquireResult> {
  const pack = await prisma.applicationPackage.findFirst({
    where: { id: packageId, userId },
    select: {
      id: true,
      jobPostingId: true,
      resumeVersionId: true,
      resumeVersionRevisionId: true,
      sourceResumeContentHash: true,
    },
  });
  if (!pack?.jobPostingId || !pack.resumeVersionRevisionId) {
    return { outcome: "BLOCKED", packageId, applicationId: null, sessionId: null, attemptId: null, blockers: ["PACKAGE_MISSING"], domain: null };
  }
  const jobPostingId = pack.jobPostingId;
  const resumeVersionRevisionId = pack.resumeVersionRevisionId;

  const readiness = await evaluateApplicationReadiness(userId, packageId);
  if (readiness.blockers.includes("EXECUTION_ALREADY_CONFIRMED")) {
    return { outcome: "ALREADY_SUBMITTED", packageId, applicationId: null, sessionId: null, attemptId: null, blockers: readiness.blockers, domain: "SUBMITTED_CONFIRMED" };
  }
  if (readiness.blockers.includes("SUBMISSION_UNCERTAIN_REQUIRES_REVIEW")) {
    return { outcome: "ALREADY_UNCERTAIN", packageId, applicationId: null, sessionId: null, attemptId: null, blockers: readiness.blockers, domain: "SUBMIT_UNCERTAIN" };
  }
  const executionBlockers = readiness.blockers.filter(
    (code) => code !== "EXECUTION_ALREADY_CONFIRMED" && code !== "SUBMISSION_UNCERTAIN_REQUIRES_REVIEW",
  );
  if (executionBlockers.length > 0 || readiness.status === "BLOCKED") {
    return { outcome: "BLOCKED", packageId, applicationId: null, sessionId: null, attemptId: null, blockers: readiness.blockers, domain: null };
  }

  const idempotencyKey = submissionIdempotencyKey({ userId, submissionPackageId: packageId, provider: LOCAL_PROVIDER });
  const existing = await prisma.applicationSubmissionAttempt.findFirst({
    where: { idempotencyKey },
    select: {
      id: true,
      status: true,
      verificationStatus: true,
      submitBoundaryCrossedAt: true,
      executionSessionId: true,
      applicationId: true,
      applicationPackageId: true,
    },
  });
  if (existing) {
    const outcome = classifyExisting(existing);
    if (outcome) {
      return {
        outcome,
        packageId,
        applicationId: existing.applicationId,
        sessionId: existing.executionSessionId,
        attemptId: existing.id,
        blockers: [],
        domain: outcome === "ALREADY_SUBMITTED" ? "SUBMITTED_CONFIRMED" : outcome === "ALREADY_UNCERTAIN" ? "SUBMIT_UNCERTAIN" : "READY_TO_EXECUTE",
      };
    }
    if ((existing.status === "FAILED" || existing.status === "CANCELLED") && !existing.submitBoundaryCrossedAt) {
      assertDomainTransition("FAILED_BEFORE_SUBMIT", "READY_TO_EXECUTE");
      await prisma.applicationSubmissionAttempt.update({
        where: { id: existing.id },
        data: { status: "APPROVAL_GRANTED", failureCode: null, failureMessage: null },
      });
      await prisma.applicationExecutionSession.update({
        where: { id: existing.executionSessionId },
        data: { status: "READY_TO_SUBMIT", failureCode: null, failureMessage: null },
      });
      return {
        outcome: "ACQUIRED",
        packageId,
        applicationId: existing.applicationId,
        sessionId: existing.executionSessionId,
        attemptId: existing.id,
        blockers: [],
        domain: "READY_TO_EXECUTE",
      };
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          userId,
          jobPostingId,
          status: "DRAFT",
          resumeVersionId: pack.resumeVersionId,
          resumeVersionRevisionId,
          contextSnapshotJson: {},
        },
      });
      const session = await tx.applicationExecutionSession.create({
        data: {
          userId,
          applicationPackageId: packageId,
          applicationId: application.id,
          jobPostingId,
          provider: LOCAL_PROVIDER,
          status: "READY_TO_SUBMIT",
        },
      });
      const attempt = await tx.applicationSubmissionAttempt.create({
        data: {
          userId,
          executionSessionId: session.id,
          applicationPackageId: packageId,
          applicationId: application.id,
          attemptNumber: 1,
          method: "BROWSER_CONFIRMED",
          status: "APPROVAL_GRANTED",
          approvalFingerprint: idempotencyKey,
          idempotencyKey,
          destinationUrl: "http://127.0.0.1/careeros-qa-provider",
          resumeVersionRevisionId,
          resumeFileHash: pack.sourceResumeContentHash ?? "package",
        },
      });
      return { application, session, attempt };
    });
    return {
      outcome: "ACQUIRED",
      packageId,
      applicationId: created.application.id,
      sessionId: created.session.id,
      attemptId: created.attempt.id,
      blockers: [],
      domain: "READY_TO_EXECUTE",
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.applicationSubmissionAttempt.findFirst({ where: { idempotencyKey } });
      return {
        outcome: winner?.status === "UNCERTAIN" ? "ALREADY_UNCERTAIN" : winner?.status === "COMPLETED" ? "ALREADY_SUBMITTED" : "ALREADY_EXECUTING",
        packageId,
        applicationId: winner?.applicationId ?? null,
        sessionId: winner?.executionSessionId ?? null,
        attemptId: winner?.id ?? null,
        blockers: [],
        domain: "READY_TO_EXECUTE",
      };
    }
    throw error;
  }
}

async function ownedAttempt(userId: string, attemptId: string) {
  const attempt = await prisma.applicationSubmissionAttempt.findFirst({
    where: { id: attemptId, userId },
  });
  if (!attempt) throw new Error("NOT_FOUND");
  const application = await prisma.application.findUnique({
    where: { id: attempt.applicationId },
    select: { id: true, status: true },
  });
  if (!application || application.id !== attempt.applicationId) throw new Error("NOT_FOUND");
  return { ...attempt, application };
}

/**
 * Submit boundary is persisted before the provider click.
 * Only the caller that wins the conditional update may invoke the provider.
 * A throw after that update is SUBMIT_UNCERTAIN and is never retried automatically.
 */
export async function executeControlledSubmit(
  userId: string,
  attemptId: string,
  runProvider: (hooks: { onSubmitBoundary: () => Promise<{ proceed: boolean }> }) => Promise<ProviderExecutionResult>,
  options?: { finalizerFault?: FinalizerFaultPoint },
): Promise<{ domain: ExecutionDomainState; providerInvoked: boolean; applicationStatus: string }> {
  const attempt = await ownedAttempt(userId, attemptId);
  if (attempt.status === "COMPLETED" && attempt.verificationStatus === "VERIFIED") {
    return { domain: "SUBMITTED_CONFIRMED", providerInvoked: false, applicationStatus: attempt.application.status };
  }
  if (attempt.status === "UNCERTAIN" || (attempt.submitBoundaryCrossedAt && attempt.status !== "APPROVAL_GRANTED" && attempt.status !== "FAILED")) {
    return {
      domain: attempt.status === "COMPLETED" ? "SUBMITTED_CONFIRMED" : "SUBMIT_UNCERTAIN",
      providerInvoked: false,
      applicationStatus: attempt.application.status,
    };
  }
  if (attempt.status === "FAILED" && attempt.submitBoundaryCrossedAt) {
    return { domain: "FAILED_AFTER_SUBMIT_ATTEMPT", providerInvoked: false, applicationStatus: attempt.application.status };
  }

  let invoked = false;
  let boundary = false;
  const onSubmitBoundary = async () => {
    const updated = await prisma.applicationSubmissionAttempt.updateMany({
      where: { id: attempt.id, userId, submitBoundaryCrossedAt: null, status: "APPROVAL_GRANTED" },
      data: { status: "SUBMITTING", submitBoundaryCrossedAt: new Date(), startedAt: new Date() },
    });
    if (updated.count !== 1) return { proceed: false };
    boundary = true;
    await prisma.applicationExecutionSession.update({
      where: { id: attempt.executionSessionId },
      data: { status: "SUBMITTING", lastActivityAt: new Date() },
    });
    await recordExecutionEvent(prisma, {
      userId,
      executionSessionId: attempt.executionSessionId,
      type: "SUBMIT_STARTED",
      message: "Submit boundary crossed. Provider submit may now run once.",
      metadata: { attemptId: attempt.id, packageId: attempt.applicationPackageId },
    });
    return { proceed: true };
  };

  try {
    invoked = true;
    const result = await runProvider({ onSubmitBoundary });
    if (!boundary && !result.submitTriggered && !result.failure) {
      const application = await prisma.application.findUniqueOrThrow({ where: { id: attempt.applicationId }, select: { status: true } });
      return { domain: "READY_TO_EXECUTE", providerInvoked: false, applicationStatus: application.status };
    }
    if (!boundary && !result.submitTriggered) {
      await markBeforeSubmitFailure(userId, attempt.id, result.failure?.code ?? "FORM_UNAVAILABLE");
      const application = await prisma.application.findUniqueOrThrow({ where: { id: attempt.applicationId }, select: { status: true } });
      return { domain: "FAILED_BEFORE_SUBMIT", providerInvoked: true, applicationStatus: application.status };
    }
    if (!boundary && result.submitTriggered) {
      await markUncertain(userId, attempt.id, "CONFIRMATION_TIMEOUT");
      const application = await prisma.application.findUniqueOrThrow({ where: { id: attempt.applicationId }, select: { status: true } });
      return { domain: "SUBMIT_UNCERTAIN", providerInvoked: true, applicationStatus: application.status };
    }
    if (result.confirmed && result.submitTriggered) {
      await confirmTrackedSubmission(
        userId,
        attempt.id,
        result.providerReference ?? null,
        result.confirmationEvidence ?? "provider-confirmation",
        options?.finalizerFault,
      );
      return { domain: "SUBMITTED_CONFIRMED", providerInvoked: true, applicationStatus: "APPLIED" };
    }
    if (result.failure?.phase === "AFTER_SUBMIT" || result.submitTriggered) {
      if (result.failure?.code === "SUBMISSION_REJECTED") {
        await markRejected(userId, attempt.id);
        const application = await prisma.application.findUniqueOrThrow({ where: { id: attempt.applicationId }, select: { status: true } });
        return { domain: "FAILED_AFTER_SUBMIT_ATTEMPT", providerInvoked: true, applicationStatus: application.status };
      }
      await markUncertain(userId, attempt.id, result.failure?.code ?? "CONFIRMATION_TIMEOUT");
      const application = await prisma.application.findUniqueOrThrow({ where: { id: attempt.applicationId }, select: { status: true } });
      return { domain: "SUBMIT_UNCERTAIN", providerInvoked: true, applicationStatus: application.status };
    }
    await markBeforeSubmitFailure(userId, attempt.id, result.failure?.code ?? "FORM_UNAVAILABLE");
    const application = await prisma.application.findUniqueOrThrow({ where: { id: attempt.applicationId }, select: { status: true } });
    return { domain: "FAILED_BEFORE_SUBMIT", providerInvoked: true, applicationStatus: application.status };
  } catch (error) {
    if (error instanceof FinalizerFault) throw error;
    if (boundary) {
      await markUncertain(userId, attempt.id, "BROWSER_CRASHED");
      const application = await prisma.application.findUniqueOrThrow({ where: { id: attempt.applicationId }, select: { status: true } });
      return { domain: "SUBMIT_UNCERTAIN", providerInvoked: invoked, applicationStatus: application.status };
    }
    await markBeforeSubmitFailure(userId, attempt.id, "BROWSER_CRASHED");
    const application = await prisma.application.findUniqueOrThrow({ where: { id: attempt.applicationId }, select: { status: true } });
    return { domain: "FAILED_BEFORE_SUBMIT", providerInvoked: invoked, applicationStatus: application.status };
  }
}

async function markBeforeSubmitFailure(userId: string, attemptId: string, code: string) {
  const attempt = await ownedAttempt(userId, attemptId);
  assertDomainTransition("READY_AT_SUBMIT_BOUNDARY", "FAILED_BEFORE_SUBMIT");
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attempt.id },
    data: { status: "FAILED", failureCode: code === "BROWSER_CRASHED" ? "BROWSER_CRASHED" : "VALIDATION_FAILED", failureMessage: code },
  });
  await prisma.applicationExecutionSession.update({
    where: { id: attempt.executionSessionId },
    data: { status: "FAILED", failureCode: "VALIDATION_FAILED", failureMessage: code },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: attempt.executionSessionId,
    type: "SESSION_FAILED",
    message: "Execution failed before the submit action. Nothing was submitted.",
    metadata: { attemptId, code },
  });
}

async function markRejected(userId: string, attemptId: string) {
  const attempt = await ownedAttempt(userId, attemptId);
  assertDomainTransition("SUBMITTING", "FAILED_AFTER_SUBMIT_ATTEMPT");
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attempt.id },
    data: { status: "FAILED", failureCode: "SUBMISSION_REJECTED", failureMessage: "Provider explicitly rejected the application.", verificationStatus: "FAILED" },
  });
  await prisma.applicationExecutionSession.update({
    where: { id: attempt.executionSessionId },
    data: { status: "FAILED", failureCode: "SUBMISSION_REJECTED", failureMessage: "Provider explicitly rejected the application." },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: attempt.executionSessionId,
    type: "SUBMIT_RESPONSE",
    message: "Provider explicitly rejected the application. This is not an uncertain result.",
    metadata: { attemptId },
  });
}

async function markUncertain(userId: string, attemptId: string, code: string) {
  const attempt = await ownedAttempt(userId, attemptId);
  if (attempt.status === "UNCERTAIN") return;
  assertDomainTransition("SUBMITTING", "SUBMIT_UNCERTAIN");
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "UNCERTAIN",
      verificationStatus: "UNVERIFIED",
      failureCode: "SUBMISSION_UNCERTAIN",
      failureMessage: code,
      submitBoundaryCrossedAt: attempt.submitBoundaryCrossedAt ?? new Date(),
    },
  });
  await prisma.applicationExecutionSession.update({
    where: { id: attempt.executionSessionId },
    data: { status: "INTERRUPTED", failureCode: "SUBMISSION_UNCERTAIN", failureMessage: code },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: attempt.executionSessionId,
    type: "VERIFICATION_RESULT",
    message: "Submission status uncertain. Automatic retry is disabled.",
    metadata: { attemptId, code },
  });
}

export async function confirmTrackedSubmission(
  userId: string,
  attemptId: string,
  providerReference: string | null,
  confirmationType: string,
  faultPoint?: FinalizerFaultPoint,
) {
  const attempt = await ownedAttempt(userId, attemptId);
  if (attempt.status === "COMPLETED" && attempt.verificationStatus === "VERIFIED" && attempt.application.status === "APPLIED") {
    return attempt.applicationId;
  }
  assertDomainTransition(attempt.status === "UNCERTAIN" ? "SUBMIT_UNCERTAIN" : "SUBMITTING", "SUBMITTED_CONFIRMED");
  const persisted = await persistTrustedConfirmation(userId, attempt.id, {
    confirmationType,
    confirmationReference: providerReference,
    confirmationEvidence: confirmationType,
  });
  if (!persisted) throw new Error("INVALID_CONFIRMATION");
  const result = await finalizeConfirmedSubmission({
    userId,
    submissionAttemptId: attempt.id,
    submissionPackageId: attempt.applicationPackageId,
    applicationId: attempt.applicationId,
  }, faultPoint ? { faultPoint } : undefined);
  if (result !== "FINALIZED" && result !== "ALREADY_FINALIZED") throw new Error(result);
  return attempt.applicationId;
}

export async function abortBeforeSubmit(userId: string, attemptId: string) {
  const attempt = await ownedAttempt(userId, attemptId);
  if (attempt.submitBoundaryCrossedAt) {
    throw new Error("Cannot abort as a safe cancel after the submit boundary.");
  }
  assertDomainTransition("READY_TO_EXECUTE", "USER_ABORTED");
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attempt.id },
    data: { status: "CANCELLED", failureMessage: "User aborted before submit." },
  });
  await prisma.applicationExecutionSession.update({
    where: { id: attempt.executionSessionId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: attempt.executionSessionId,
    type: "SESSION_CANCELLED",
    message: "User aborted before submit. This is not an uncertain submission.",
    metadata: { attemptId },
  });
}

export async function resolveUncertainSubmission(userId: string, attemptId: string, submitted: boolean) {
  const attempt = await ownedAttempt(userId, attemptId);
  if (attempt.status !== "UNCERTAIN") throw new Error("Only an uncertain submission can be resolved manually.");
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: attempt.executionSessionId,
    type: "VERIFICATION_RESULT",
    message: submitted ? "User verified this was submitted." : "User verified it was not submitted.",
    metadata: {
      attemptId,
      resolution: submitted ? "SUBMITTED" : "NOT_SUBMITTED",
      previousBoundary: attempt.submitBoundaryCrossedAt?.toISOString() ?? null,
    },
  });
  if (submitted) {
    await confirmTrackedSubmission(userId, attemptId, null, "user-verified");
    return "SUBMITTED_CONFIRMED" as const;
  }
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "FAILED",
      failureCode: null,
      failureMessage: "User verified the provider did not receive the application.",
      submitBoundaryCrossedAt: null,
    },
  });
  return "NOT_SUBMITTED" as const;
}
