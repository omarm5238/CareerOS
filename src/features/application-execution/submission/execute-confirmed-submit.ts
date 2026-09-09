import { createHash } from "node:crypto";

import { prisma } from "@/server/db/prisma";

import { selectAdapter } from "../adapters/adapter-registry";
import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import { nowMs } from "../lib/clock";
import { ExecutionAccessError } from "../lib/permissions";
import { recordExecutionEvent } from "../sessions/execution-event";
import { loadOwnedSession, sessionJson } from "../sessions/load-owned-session";
import { buildFinalSubmissionSnapshot, submissionFingerprint } from "./build-final-submission-snapshot";
import { withSubmissionLock } from "./submission-lock";
import { applyVerifiedSuccess } from "./verify-submission";

export async function executeConfirmedSubmit(userId: string, sessionId: string, attemptId: string, approvalToken: string) {
  return withSubmissionLock(sessionId, async () => {
    const row = await loadOwnedSession(userId, sessionId);
    const attempt = row.submissionAttempts.find((item) => item.id === attemptId);
    if (!attempt || attempt.userId !== userId) {
      throw new ExecutionAccessError("NOT_FOUND", "Submission attempt not found.");
    }
    if (attempt.status === "COMPLETED" || attempt.status === "VERIFYING" || attempt.status === "UNCERTAIN" || attempt.status === "SUBMITTING") {
      throw new ExecutionAccessError("CONFLICT", "This approval token cannot be used for another submit.");
    }
    if (attempt.approvalUsedAt) {
      throw new ExecutionAccessError("CONFLICT", "This approval token has already been used.");
    }
    if (!attempt.approvalExpiresAt || attempt.approvalExpiresAt.getTime() < nowMs()) {
      throw new ExecutionAccessError("CONFLICT", "Submit approval expired. Review the application again.");
    }
    const tokenHash = createHash("sha256").update(approvalToken).digest("hex");
    if (!attempt.approvalTokenHash || tokenHash !== attempt.approvalTokenHash) {
      throw new ExecutionAccessError("FORBIDDEN", "Submit approval is invalid.");
    }
    if (row.status !== "READY_TO_SUBMIT") {
      throw new ExecutionAccessError("CONFLICT", "Cannot submit from the current execution state.");
    }
    if (row.application.status !== "DRAFT") {
      throw new ExecutionAccessError("CONFLICT", "Application must still be DRAFT immediately before submit.");
    }

    const { snapshot, plan } = sessionJson(row);
    if (!snapshot) throw new ExecutionAccessError("CONFLICT", "Form inspection is missing.");
    const current = submissionFingerprint(buildFinalSubmissionSnapshot(row, snapshot, plan));
    if (current !== attempt.approvalFingerprint) {
      throw new ExecutionAccessError("CONFLICT", "Application changed. Review it again.");
    }

    const page = getApplicationBrowserRunner().getPage(sessionId);
    if (!page) throw new ExecutionAccessError("CONFLICT", "Browser is not connected.");
    const adapter = selectAdapter(row.provider, false);
    if (!adapter.capabilities().confirmedBrowserSubmit) {
      throw new ExecutionAccessError("CONFLICT", "Confirmed browser submit is not available.");
    }
    const control = await adapter.locateFinalSubmit(page);
    if (!control?.isFinal) {
      throw new ExecutionAccessError("CONFLICT", "No trusted final submit control is available.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.applicationSubmissionAttempt.update({
        where: { id: attempt.id },
        data: { approvalUsedAt: new Date(nowMs()), status: "SUBMITTING", startedAt: new Date() },
      });
      await tx.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: "SUBMITTING", lastActivityAt: new Date() },
      });
    });
    await recordExecutionEvent(prisma, {
      userId,
      executionSessionId: sessionId,
      type: "SUBMIT_STARTED",
      message: "Executing one trusted submit action for this application.",
    });

    try {
      await adapter.executeConfirmedSubmit(page, control.selector.value);
    } catch (error) {
      await prisma.applicationSubmissionAttempt.update({
        where: { id: attempt.id },
        data: { status: "UNCERTAIN", failureCode: "SUBMISSION_UNCERTAIN", failureMessage: "Submit action may have reached the provider." },
      });
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: "VERIFYING", failureCode: "SUBMISSION_UNCERTAIN" },
      });
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: "SUBMIT_RESPONSE",
        message: "Submit response was uncertain. CareerOS will not click Submit again.",
      });
      throw error;
    }

    await prisma.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: { status: "VERIFYING", submittedAt: new Date() },
    });
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: { status: "VERIFYING" },
    });
    await recordExecutionEvent(prisma, {
      userId,
      executionSessionId: sessionId,
      type: "SUBMIT_RESPONSE",
      message: "Submit action completed. Verifying provider result.",
    });

    return verifyAfterSubmit(userId, sessionId, attempt.id);
  });
}

async function verifyAfterSubmit(userId: string, sessionId: string, attemptId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  const page = getApplicationBrowserRunner().getPage(sessionId);
  if (!page) {
    await prisma.applicationSubmissionAttempt.update({
      where: { id: attemptId },
      data: { status: "UNCERTAIN", verificationStatus: "UNVERIFIED", failureCode: "SUBMISSION_UNCERTAIN" },
    });
    return loadOwnedSession(userId, sessionId);
  }
  const adapter = selectAdapter(row.provider, false);
  const result = await adapter.verifySubmission(page);
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attemptId },
    data: {
      verificationStatus: result.status,
      status: result.status === "FAILED" ? "FAILED" : result.status === "VERIFIED" ? "COMPLETED" : "UNCERTAIN",
      confirmationUrl: result.confirmationUrl,
      providerApplicationId: result.providerApplicationId,
      verificationEvidenceJson: {
        provider: row.provider,
        verificationMethod: result.method,
        successMarkerCode: result.successMarkerCode,
        confirmationUrl: result.confirmationUrl,
        providerApplicationId: result.providerApplicationId,
        pageFingerprint: result.pageFingerprint,
        verifiedAt: new Date().toISOString(),
      },
      verifiedAt: result.status === "VERIFIED" ? new Date() : null,
      failureCode: result.status === "FAILED" ? "SUBMISSION_REJECTED" : result.status === "VERIFIED" ? null : "SUBMISSION_UNCERTAIN",
    },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "VERIFICATION_RESULT",
    message: result.message,
    metadata: { status: result.status, method: result.method, successMarkerCode: result.successMarkerCode },
  });
  if (result.status === "VERIFIED") {
    await applyVerifiedSuccess(userId, sessionId, attemptId, "provider");
  } else if (result.status === "FAILED") {
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: { status: "FAILED", failureCode: "SUBMISSION_REJECTED", failureMessage: result.message },
    });
  }
  return loadOwnedSession(userId, sessionId);
}

export { verifyAfterSubmit };
