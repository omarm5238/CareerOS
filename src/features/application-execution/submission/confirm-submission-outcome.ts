import { prisma } from "@/server/db/prisma";

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
