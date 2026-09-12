import { prisma } from "@/server/db/prisma";

import { toPrismaJson } from "../lib/json-parsers";
import { recordExecutionEvent } from "../sessions/execution-event";
import { loadOwnedSession, sessionJson } from "../sessions/load-owned-session";
import { assertReadyToSubmit, buildFinalReview } from "./build-final-submission-snapshot";
import { readLiveSubmissionState } from "./read-live-submission-state";

export async function reviewExecutionSession(userId: string, sessionId: string) {
  const connected = await readLiveIfPossible(userId, sessionId);
  const row = await loadOwnedSession(userId, sessionId);
  if (row.status === "BLOCKED" || row.status === "PAUSED_FOR_CAPTCHA" || row.status === "PAUSED_FOR_LOGIN" || row.status === "PAUSED_FOR_MFA" || row.status === "PAUSED_FOR_ASSESSMENT") {
    const { snapshot, plan } = sessionJson(row);
    return { review: snapshot ? buildFinalReview(row, snapshot, plan) : null, readyToSubmit: false, liveInspected: true };
  }
  const { snapshot, plan } = sessionJson(row);
  if (!snapshot) return { review: null, readyToSubmit: false };
  const review = buildFinalReview(row, snapshot, plan);
  if (review.resumeRevisionId) {
    const revision = await prisma.resumeVersionRevision.findFirst({
      where: { id: review.resumeRevisionId, userId },
      select: { revisionNumber: true },
    });
    review.resumeRevisionNumber = revision?.revisionNumber ?? null;
  }
  if (review.coverLetterRevisionId) {
    const revision = await prisma.communicationDraftRevision.findFirst({
      where: { id: review.coverLetterRevisionId, userId },
      select: { revisionNumber: true },
    });
    review.coverLetterRevisionNumber = revision?.revisionNumber ?? null;
  }
  const drifted = row.provider === "GENERIC" || JSON.stringify(row.warningsJson).includes("ADAPTER_DRIFT");
  const runtime = plan.runtimeCapability ?? null;
  const canSubmit = Boolean(runtime?.confirmedBrowserSubmit) && review.unresolved.length === 0 && !drifted;
  if (review.unresolved.length === 0) {
    try {
      if (canSubmit) assertReadyToSubmit(row, snapshot, plan, drifted, runtime);
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: {
          status: canSubmit ? "READY_TO_SUBMIT" : "READY_FOR_REVIEW",
          executionMode: canSubmit ? "CONFIRMED_BROWSER_SUBMIT" : "ASSISTED_BROWSER",
          lastActivityAt: new Date(),
        },
      });
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: canSubmit ? "READY_FOR_SUBMIT" : "READY_FOR_REVIEW",
        message: canSubmit
          ? "Application is ready for an explicit per-application submit approval."
          : "CareerOS can assist with this application, but final submission must be completed manually.",
      });
    } catch {
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: "READY_FOR_REVIEW", executionMode: "ASSISTED_BROWSER", lastActivityAt: new Date() },
      });
    }
  }
  return { review, readyToSubmit: canSubmit && review.unresolved.length === 0, liveInspected: connected };
}

async function readLiveIfPossible(userId: string, sessionId: string): Promise<boolean> {
  try {
    const live = await readLiveSubmissionState(userId, sessionId);
    const blocked =
      live.block === "JOB_CLOSED" || live.block === "DUPLICATE_APPLICATION"
        ? {
            status: "BLOCKED" as const,
            failureCode: live.block,
            failureMessage:
              live.block === "JOB_CLOSED"
                ? "This job is no longer available."
                : "The provider reports an application already exists.",
          }
        : live.interruption.kind === "CAPTCHA" || live.interruption.kind === "CHALLENGE_FRAME"
          ? {
              status: "PAUSED_FOR_CAPTCHA" as const,
              failureCode: "CAPTCHA_REQUIRED" as const,
              failureMessage: live.interruption.message,
            }
          : null;
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: {
        formSnapshotJson: toPrismaJson(live.snapshot),
        fillPlanJson: toPrismaJson(live.plan),
        formFingerprint: live.fingerprint,
        lastActivityAt: new Date(),
        executionMode: live.runtimeCapability.confirmedBrowserSubmit ? "CONFIRMED_BROWSER_SUBMIT" : "ASSISTED_BROWSER",
        ...(blocked ?? {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}
