import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/server/db/prisma";

import { adapterSupportsConfirmedSubmit } from "../adapters/adapter-registry";
import { approvalTtlMs, nowMs } from "../lib/clock";
import { toPrismaJson } from "../lib/json-parsers";
import { ExecutionAccessError } from "../lib/permissions";
import { recordExecutionEvent } from "../sessions/execution-event";
import { loadOwnedSession, sessionJson } from "../sessions/load-owned-session";
import { assertReadyToSubmit, buildFinalSubmissionSnapshot, submissionFingerprint } from "./build-final-submission-snapshot";

export async function grantSubmissionApproval(userId: string, sessionId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  if (row.application.status !== "DRAFT") {
    throw new ExecutionAccessError("CONFLICT", "Application must still be DRAFT before submit approval.");
  }
  const { snapshot, plan } = sessionJson(row);
  if (!snapshot) throw new ExecutionAccessError("CONFLICT", "Form has not been inspected.");
  const drifted = row.provider === "GENERIC";
  if (!adapterSupportsConfirmedSubmit(row.provider, drifted)) {
    throw new ExecutionAccessError("CONFLICT", "Generic adapter does not support confirmed browser submit.");
  }
  assertReadyToSubmit(row, snapshot, plan, drifted);

  const finalSnapshot = buildFinalSubmissionSnapshot(row, snapshot, plan);
  const fingerprint = submissionFingerprint(finalSnapshot);
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const resume = plan.uploadedDocuments.find((item) => item.kind === "resume");
  const cover = plan.uploadedDocuments.find((item) => item.kind === "cover_letter");
  if (!resume || !row.applicationPackage.resumeVersionRevisionId) {
    throw new ExecutionAccessError("CONFLICT", "Exact resume artifact is required.");
  }

  const nextNumber = (row.submissionAttempts[0]?.attemptNumber ?? 0) + 1;
  const attempt = await prisma.applicationSubmissionAttempt.create({
    data: {
      userId,
      executionSessionId: sessionId,
      applicationPackageId: row.applicationPackageId,
      applicationId: row.applicationId,
      attemptNumber: nextNumber,
      method: "BROWSER_CONFIRMED",
      status: "APPROVAL_GRANTED",
      verificationStatus: "NOT_RUN",
      approvalFingerprint: fingerprint,
      approvalTokenHash: tokenHash,
      approvalExpiresAt: new Date(nowMs() + approvalTtlMs()),
      finalSubmissionSnapshotJson: toPrismaJson(finalSnapshot),
      resumeVersionRevisionId: row.applicationPackage.resumeVersionRevisionId,
      resumeFileHash: resume.fileHash,
      coverLetterRevisionId: cover?.revisionId ?? row.applicationPackage.coverLetterRevisionId,
      coverLetterFileHash: cover?.fileHash,
    },
  });

  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: { status: "READY_TO_SUBMIT", lastActivityAt: new Date() },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "SUBMISSION_APPROVED",
    message: "Submit approval granted for this specific application only.",
    metadata: { attemptId: attempt.id },
  });

  return {
    attemptId: attempt.id,
    approvalToken: token,
    approvalExpiresAt: attempt.approvalExpiresAt?.toISOString() ?? null,
    approvalFingerprint: fingerprint,
  };
}
