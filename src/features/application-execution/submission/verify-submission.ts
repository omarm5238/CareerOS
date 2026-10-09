import { prisma } from "@/server/db/prisma";

import { transitionApplicationStatus } from "@/features/applications/lib/transition-application-status";

import { selectAdapter } from "../adapters/adapter-registry";
import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import { finalizeConfirmedSubmission, persistTrustedConfirmation } from "../integrity/finalize-confirmed-submission";
import { toPrismaJson } from "../lib/json-parsers";
import { ExecutionAccessError } from "../lib/permissions";
import { recordExecutionEvent } from "../sessions/execution-event";
import { loadOwnedSession } from "../sessions/load-owned-session";

export async function verifySubmission(userId: string, sessionId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  const attempt = row.submissionAttempts[0];
  if (!attempt) throw new ExecutionAccessError("CONFLICT", "No submission attempt to verify.");
  if (attempt.status === "APPROVAL_GRANTED") {
    throw new ExecutionAccessError("CONFLICT", "Verification does not submit. No submit has occurred yet.");
  }
  if (attempt.status === "COMPLETED" && (attempt.verificationStatus === "VERIFIED" || row.application.status === "APPLIED")) {
    return row;
  }
  const page = getApplicationBrowserRunner().getPage(sessionId);
  if (!page) {
    if (attempt.verificationStatus === "VERIFIED" || attempt.status === "COMPLETED") {
      return row;
    }
    await prisma.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: { verificationStatus: "UNVERIFIED", status: "UNCERTAIN", failureCode: "SUBMISSION_UNCERTAIN" },
    });
    return loadOwnedSession(userId, sessionId);
  }
  const adapter = selectAdapter(row.provider, false);
  const result = await adapter.verifySubmission(page);
  const alreadyApplied = row.application.status === "APPLIED";
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attempt.id },
    data: {
      verificationStatus: result.status === "VERIFIED" ? attempt.verificationStatus : result.status,
      confirmationUrl: result.confirmationUrl,
      providerApplicationId: result.providerApplicationId,
      confirmationType: result.status === "VERIFIED" ? (attempt.confirmationType ?? "provider-confirmation") : attempt.confirmationType,
      verificationEvidenceJson: toPrismaJson({
        provider: row.provider,
        verificationMethod: result.method,
        successMarkerCode: result.successMarkerCode,
        confirmationUrl: result.confirmationUrl,
        providerApplicationId: result.providerApplicationId,
        pageFingerprint: result.pageFingerprint,
        trustedConfirmation: result.status === "VERIFIED",
        verifiedAt: new Date().toISOString(),
      }),
      status: result.status === "FAILED" ? "FAILED" : attempt.status,
    },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "VERIFICATION_RESULT",
    message: result.message,
    metadata: { status: result.status, method: result.method },
  });
  if (result.status === "VERIFIED" && !alreadyApplied) {
    await applyVerifiedSuccess(userId, sessionId, attempt.id, "provider");
  }
  return loadOwnedSession(userId, sessionId);
}

export async function applyVerifiedSuccess(
  userId: string,
  sessionId: string,
  attemptId: string,
  source: "provider" | "user",
) {
  const row = await loadOwnedSession(userId, sessionId);
  const attempt = row.submissionAttempts.find((item) => item.id === attemptId) ?? row.submissionAttempts[0];
  if (!attempt || attempt.id !== attemptId) {
    throw new ExecutionAccessError("NOT_FOUND", "Submission attempt not found.");
  }
  if (attempt.submitBoundaryCrossedAt) {
    const persisted = await persistTrustedConfirmation(userId, attempt.id, {
      confirmationType: source === "provider" ? "provider-confirmation" : "user-verified",
      confirmationReference: attempt.providerApplicationId,
    });
    if (!persisted) throw new ExecutionAccessError("CONFLICT", "Confirmation is not trusted.");
    const result = await finalizeConfirmedSubmission({
      userId,
      submissionAttemptId: attempt.id,
      submissionPackageId: row.applicationPackageId,
      applicationId: row.applicationId,
    });
    if (result !== "FINALIZED" && result !== "ALREADY_FINALIZED") {
      throw new ExecutionAccessError("CONFLICT", "Submission could not be finalized.");
    }
    await getApplicationBrowserRunner().close(sessionId).catch(() => undefined);
    return;
  }
  if (source === "provider") {
    throw new ExecutionAccessError("CONFLICT", "Provider confirmation without a submit boundary cannot be finalized.");
  }
  await transitionApplicationStatus({
    userId,
    applicationId: row.applicationId,
    toStatus: "APPLIED",
    submittedPackageId: row.applicationPackageId,
    submittedExecutionAttemptId: attemptId,
    resumeVersionId: row.applicationPackage.resumeVersionId,
    resumeVersionRevisionId: row.applicationPackage.resumeVersionRevisionId,
    provider: row.provider,
  });
  await prisma.applicationPackage.update({
    where: { id: row.applicationPackageId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attemptId },
    data: { status: "COMPLETED", submittedAt: new Date() },
  });
  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: { status: "SUBMITTED", completedAt: new Date(), lastActivityAt: new Date() },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "SESSION_COMPLETED",
    message: "User confirmed a manual submission. No provider execution boundary was crossed.",
  });
  await getApplicationBrowserRunner().close(sessionId).catch(() => undefined);
}
