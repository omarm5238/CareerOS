import { prisma } from "@/server/db/prisma";

import { finalizeConfirmedSubmission, persistTrustedConfirmation } from "../integrity/finalize-confirmed-submission";
import { toPrismaJson } from "../lib/json-parsers";
import { ExecutionAccessError } from "../lib/permissions";
import { recordExecutionEvent } from "../sessions/execution-event";
import { loadOwnedSession } from "../sessions/load-owned-session";
import type { ConfirmOutcome } from "../types";
import { applyVerifiedSuccess } from "./verify-submission";

export async function confirmSubmissionOutcome(userId: string, sessionId: string, outcome: ConfirmOutcome) {
  const row = await loadOwnedSession(userId, sessionId);
  let attempt = row.submissionAttempts[0];
  if (attempt?.verificationStatus === "VERIFIED") {
    return loadOwnedSession(userId, sessionId);
  }

  if (!attempt) {
    const resume = row.applicationPackage.resumeVersionRevisionId;
    if (!resume) throw new ExecutionAccessError("CONFLICT", "Exact resume revision is missing.");
    attempt = await prisma.applicationSubmissionAttempt.create({
      data: {
        userId,
        executionSessionId: sessionId,
        applicationPackageId: row.applicationPackageId,
        applicationId: row.applicationId,
        attemptNumber: 1,
        method: "USER_MANUAL",
        status: "UNCERTAIN",
        verificationStatus: "UNVERIFIED",
        approvalFingerprint: row.formFingerprint ?? "manual",
        resumeVersionRevisionId: resume,
        resumeFileHash: "manual",
      },
    });
  }

  if (outcome === "SUBMITTED") {
    if (attempt.submitBoundaryCrossedAt) {
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: "VERIFICATION_RESULT",
        message: "User verified this was submitted.",
        metadata: { attemptId: attempt.id, resolution: "SUBMITTED" },
      });
      const persisted = await persistTrustedConfirmation(userId, attempt.id, { confirmationType: "user-verified" });
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
      return loadOwnedSession(userId, sessionId);
    }
    await prisma.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "COMPLETED",
        verificationEvidenceJson: toPrismaJson({
          ...(typeof attempt.verificationEvidenceJson === "object" && attempt.verificationEvidenceJson
            ? (attempt.verificationEvidenceJson as Record<string, unknown>)
            : {}),
          userConfirmed: true,
          verificationMethod: "user_confirmed",
        }),
      },
    });
    await applyVerifiedSuccess(userId, sessionId, attempt.id, "user");
    return loadOwnedSession(userId, sessionId);
  }

  if (outcome === "NOT_SUBMITTED") {
    await prisma.applicationSubmissionAttempt.update({
      where: { id: attempt.id },
      data: { status: "FAILED", failureCode: "SUBMISSION_REJECTED", failureMessage: "User reported the application was not submitted." },
    });
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: { status: "READY_FOR_REVIEW", failureMessage: "User reported the application was not submitted." },
    });
    return loadOwnedSession(userId, sessionId);
  }

  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "VERIFICATION_RESULT",
    message: "User is not sure whether the application submitted. Application remains DRAFT.",
  });
  return loadOwnedSession(userId, sessionId);
}
