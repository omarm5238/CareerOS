import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/server/db/prisma";

import { approvalTtlMs, nowMs } from "../lib/clock";
import { toPrismaJson } from "../lib/json-parsers";
import { ExecutionAccessError } from "../lib/permissions";
import { recordExecutionEvent } from "../sessions/execution-event";
import { assertReadyToSubmit, buildFinalSubmissionSnapshot, submissionFingerprint } from "./build-final-submission-snapshot";
import { readLiveSubmissionState } from "./read-live-submission-state";

export async function grantSubmissionApproval(userId: string, sessionId: string) {
  const live = await readLiveSubmissionState(userId, sessionId);
  if (live.row.application.status !== "DRAFT") {
    throw new ExecutionAccessError("CONFLICT", "Application must still be DRAFT before submit approval.");
  }
  if (live.interruption.kind === "CAPTCHA" || live.interruption.kind === "CHALLENGE_FRAME") {
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: {
        status: "PAUSED_FOR_CAPTCHA",
        failureCode: "CAPTCHA_REQUIRED",
        failureMessage: live.interruption.message,
        formSnapshotJson: toPrismaJson(live.snapshot),
        fillPlanJson: toPrismaJson(live.plan),
        formFingerprint: live.fingerprint,
      },
    });
    throw new ExecutionAccessError("CONFLICT", "CAPTCHA must be completed before submit approval.");
  }
  if (live.interruption.kind === "LOGIN" || live.interruption.kind === "MFA" || live.interruption.kind === "ASSESSMENT") {
    throw new ExecutionAccessError("CONFLICT", "Unresolved login, MFA, or assessment blocks submit approval.");
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
  if (live.row.formFingerprint && live.fingerprint !== live.row.formFingerprint) {
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: {
        status: "READY_FOR_REVIEW",
        formFingerprint: live.fingerprint,
        formSnapshotJson: toPrismaJson(live.snapshot),
        fillPlanJson: toPrismaJson(live.plan),
        failureCode: null,
        failureMessage: "The application form changed. Review it again.",
      },
    });
    throw new ExecutionAccessError("CONFLICT", "The application form changed. Review it again.");
  }
  if (!live.runtimeCapability.confirmedBrowserSubmit) {
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: {
        status: "READY_FOR_REVIEW",
        executionMode: "ASSISTED_BROWSER",
        formSnapshotJson: toPrismaJson(live.snapshot),
        fillPlanJson: toPrismaJson(live.plan),
        formFingerprint: live.fingerprint,
        lastActivityAt: new Date(),
      },
    });
    throw new ExecutionAccessError("CONFLICT", "Confirmed browser submit is not trusted for this session. Submit manually in the application browser.");
  }
  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: {
      formSnapshotJson: toPrismaJson(live.snapshot),
      fillPlanJson: toPrismaJson(live.plan),
      formFingerprint: live.fingerprint,
      lastActivityAt: new Date(),
    },
  });
  assertReadyToSubmit(live.row, live.snapshot, live.plan, live.drifted, live.runtimeCapability);

  const finalSnapshot = buildFinalSubmissionSnapshot(
    { ...live.row, formFingerprint: live.fingerprint },
    live.snapshot,
    live.plan,
  );
  const fingerprint = submissionFingerprint(finalSnapshot);
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const resume = live.plan.uploadedDocuments.find((item) => item.kind === "resume");
  const cover = live.plan.uploadedDocuments.find((item) => item.kind === "cover_letter");
  if (!resume || !live.row.applicationPackage.resumeVersionRevisionId) {
    throw new ExecutionAccessError("CONFLICT", "Exact resume artifact is required.");
  }

  const nextNumber = (live.row.submissionAttempts[0]?.attemptNumber ?? 0) + 1;
  const attempt = await prisma.applicationSubmissionAttempt.create({
    data: {
      userId,
      executionSessionId: sessionId,
      applicationPackageId: live.row.applicationPackageId,
      applicationId: live.row.applicationId,
      attemptNumber: nextNumber,
      method: "BROWSER_CONFIRMED",
      status: "APPROVAL_GRANTED",
      verificationStatus: "NOT_RUN",
      approvalFingerprint: fingerprint,
      approvalTokenHash: tokenHash,
      approvalExpiresAt: new Date(nowMs() + approvalTtlMs()),
      finalSubmissionSnapshotJson: toPrismaJson(finalSnapshot),
      resumeVersionRevisionId: live.row.applicationPackage.resumeVersionRevisionId,
      resumeFileHash: resume.fileHash,
      coverLetterRevisionId: cover?.revisionId ?? live.row.applicationPackage.coverLetterRevisionId,
      coverLetterFileHash: cover?.fileHash,
    },
  });

  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: {
      status: "READY_TO_SUBMIT",
      lastActivityAt: new Date(),
      formSnapshotJson: toPrismaJson(live.snapshot),
      fillPlanJson: toPrismaJson(live.plan),
      formFingerprint: live.fingerprint,
    },
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
