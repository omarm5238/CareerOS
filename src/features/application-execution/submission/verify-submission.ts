import { prisma } from "@/server/db/prisma";

import { transitionApplicationStatus } from "@/features/applications/lib/transition-application-status";

import { selectAdapter } from "../adapters/adapter-registry";
import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
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
      verificationStatus: result.status,
      confirmationUrl: result.confirmationUrl,
      providerApplicationId: result.providerApplicationId,
      verificationEvidenceJson: toPrismaJson({
        provider: row.provider,
        verificationMethod: result.method,
        successMarkerCode: result.successMarkerCode,
        confirmationUrl: result.confirmationUrl,
        providerApplicationId: result.providerApplicationId,
        pageFingerprint: result.pageFingerprint,
        verifiedAt: new Date().toISOString(),
      }),
      status: result.status === "VERIFIED" ? "COMPLETED" : result.status === "FAILED" ? "FAILED" : attempt.status,
      verifiedAt: result.status === "VERIFIED" ? new Date() : attempt.verifiedAt,
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
  await transitionApplicationStatus({
    userId,
    applicationId: row.applicationId,
    toStatus: "APPLIED",
  });
  await prisma.applicationPackage.update({
    where: { id: row.applicationPackageId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attemptId },
    data: {
      status: "COMPLETED",
      submittedAt: new Date(),
      verifiedAt: source === "provider" ? new Date() : undefined,
    },
  });
  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: { status: "SUBMITTED", completedAt: new Date(), lastActivityAt: new Date() },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "SESSION_COMPLETED",
    message:
      source === "provider"
        ? "Application submission verified by the provider adapter. M22 marked APPLIED."
        : "User confirmed the application was submitted. M22 marked APPLIED.",
  });
  await getApplicationBrowserRunner().close(sessionId).catch(() => undefined);
}
