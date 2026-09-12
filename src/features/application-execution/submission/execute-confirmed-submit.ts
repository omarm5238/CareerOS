import { createHash } from "node:crypto";

import { prisma } from "@/server/db/prisma";

import { selectAdapter } from "../adapters/adapter-registry";
import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import { nowMs } from "../lib/clock";
import { toPrismaJson } from "../lib/json-parsers";
import { ExecutionAccessError } from "../lib/permissions";
import { recordExecutionEvent } from "../sessions/execution-event";
import { loadOwnedSession } from "../sessions/load-owned-session";
import { buildFinalSubmissionSnapshot, submissionFingerprint } from "./build-final-submission-snapshot";
import { readLiveSubmissionState } from "./read-live-submission-state";
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

    const live = await readLiveSubmissionState(userId, sessionId);
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: {
        formSnapshotJson: toPrismaJson(live.snapshot),
        fillPlanJson: toPrismaJson(live.plan),
        formFingerprint: live.fingerprint,
        lastActivityAt: new Date(),
      },
    });

    if (live.interruption.kind === "CAPTCHA" || live.interruption.kind === "CHALLENGE_FRAME") {
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: "PAUSED_FOR_CAPTCHA", failureCode: "CAPTCHA_REQUIRED", failureMessage: live.interruption.message },
      });
      throw new ExecutionAccessError("CONFLICT", "CAPTCHA appeared before submit. CareerOS will not click Submit.");
    }
    if (live.block === "JOB_CLOSED") {
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: "BLOCKED", failureCode: "JOB_CLOSED", failureMessage: "This job is no longer available." },
      });
      throw new ExecutionAccessError("CONFLICT", "This job is closed. CareerOS will not submit.");
    }
    if (live.block === "DUPLICATE_APPLICATION") {
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: {
          status: "BLOCKED",
          failureCode: "DUPLICATE_APPLICATION",
          failureMessage: "The provider reports an application already exists.",
        },
      });
      throw new ExecutionAccessError("CONFLICT", "Provider reports a duplicate application. CareerOS will not submit.");
    }
    if (!live.runtimeCapability.confirmedBrowserSubmit) {
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: "READY_FOR_REVIEW", executionMode: "ASSISTED_BROWSER" },
      });
      throw new ExecutionAccessError("CONFLICT", "Confirmed browser submit is no longer trusted. Submit manually.");
    }

    const current = submissionFingerprint(
      buildFinalSubmissionSnapshot({ ...live.row, formFingerprint: live.fingerprint }, live.snapshot, live.plan),
    );
    if (current !== attempt.approvalFingerprint || (row.formFingerprint && live.fingerprint !== row.formFingerprint)) {
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: "READY_FOR_REVIEW", failureMessage: "The application form changed. Review it again." },
      });
      throw new ExecutionAccessError("CONFLICT", "Application changed. Review it again.");
    }

    const control = await live.adapter.locateFinalSubmit(live.page);
    if (!control?.isFinal || control.confidence < 0.85) {
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
      await live.adapter.executeConfirmedSubmit(live.page, control.selector.value);
    } catch (error) {
      await markUncertain(userId, sessionId, attempt.id, "Submit action may have reached the provider.");
      throw error;
    }

    const after = await live.adapter.detectInterruptions(live.page);
    if (after.kind === "CAPTCHA" || after.kind === "CHALLENGE_FRAME") {
      await markUncertain(userId, sessionId, attempt.id, "Provider intercepted submit with a CAPTCHA or challenge. CareerOS will not click Submit again.");
      return loadOwnedSession(userId, sessionId);
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

async function markUncertain(userId: string, sessionId: string, attemptId: string, message: string) {
  await prisma.applicationSubmissionAttempt.update({
    where: { id: attemptId },
    data: { status: "UNCERTAIN", verificationStatus: "UNVERIFIED", failureCode: "SUBMISSION_UNCERTAIN", failureMessage: message },
  });
  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: { status: "VERIFYING", failureCode: "SUBMISSION_UNCERTAIN", failureMessage: message },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "SUBMIT_RESPONSE",
    message,
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
  const failureCode =
    result.successMarkerCode === "JOB_CLOSED"
      ? "JOB_CLOSED"
      : result.successMarkerCode === "DUPLICATE_APPLICATION"
        ? "DUPLICATE_APPLICATION"
        : result.status === "FAILED"
          ? "SUBMISSION_REJECTED"
          : result.status === "VERIFIED"
            ? null
            : "SUBMISSION_UNCERTAIN";
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
      failureCode,
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
      data: { status: "FAILED", failureCode, failureMessage: result.message },
    });
  }
  return loadOwnedSession(userId, sessionId);
}

export { verifyAfterSubmit };
