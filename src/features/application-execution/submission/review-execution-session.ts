import { prisma } from "@/server/db/prisma";

import { adapterSupportsConfirmedSubmit } from "../adapters/adapter-registry";
import { recordExecutionEvent } from "../sessions/execution-event";
import { loadOwnedSession, sessionJson } from "../sessions/load-owned-session";
import { assertReadyToSubmit, buildFinalReview } from "./build-final-submission-snapshot";

export async function reviewExecutionSession(userId: string, sessionId: string) {
  const row = await loadOwnedSession(userId, sessionId);
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
  const drifted = row.provider === "GENERIC";
  const canSubmit = adapterSupportsConfirmedSubmit(row.provider, drifted) && review.unresolved.length === 0;
  if (review.unresolved.length === 0) {
    try {
      if (canSubmit) assertReadyToSubmit(row, snapshot, plan, drifted);
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: canSubmit ? "READY_TO_SUBMIT" : "READY_FOR_REVIEW", lastActivityAt: new Date() },
      });
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: canSubmit ? "READY_FOR_SUBMIT" : "READY_FOR_REVIEW",
        message: canSubmit
          ? "Application is ready for an explicit per-application submit approval."
          : "Application is ready for review. Final submit remains manual for this adapter.",
      });
    } catch {
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: "READY_FOR_REVIEW", lastActivityAt: new Date() },
      });
    }
  }
  return { review, readyToSubmit: canSubmit && review.unresolved.length === 0 };
}
