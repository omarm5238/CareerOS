import { prisma } from "@/server/db/prisma";

import { sanitizeApplyUrl } from "@/features/application-packages/lib/start-external-application";

import { ExecutionAccessError } from "../lib/permissions";
import { parseFillPlan, parseFormSnapshot, parsePendingActions, parseWarnings } from "../lib/json-parsers";
import { ACTIVE_SESSION_STATUSES } from "./execution-state-machine";

export async function loadOwnedSession(userId: string, sessionId: string) {
  const row = await prisma.applicationExecutionSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      applicationPackage: true,
      application: true,
      jobPosting: true,
      events: { orderBy: { createdAt: "desc" }, take: 40 },
      submissionAttempts: { orderBy: { attemptNumber: "desc" }, take: 5 },
    },
  });
  if (!row) throw new ExecutionAccessError("NOT_FOUND", "Execution session not found.");
  return row;
}

export async function loadOwnedSessionOr404(userId: string, sessionId: string) {
  return loadOwnedSession(userId, sessionId);
}

export function applyUrlFromJob(jobUrl: string | null): string {
  const url = sanitizeApplyUrl(jobUrl);
  if (!url) throw new ExecutionAccessError("INVALID_INPUT", "This job has no safe http(s) apply URL.");
  return url;
}

export async function findActiveSession(userId: string) {
  return prisma.applicationExecutionSession.findFirst({
    where: { userId, status: { in: ACTIVE_SESSION_STATUSES } },
    orderBy: { updatedAt: "desc" },
  });
}

export function sessionJson(row: Awaited<ReturnType<typeof loadOwnedSession>>) {
  return {
    snapshot: parseFormSnapshot(row.formSnapshotJson),
    plan: parseFillPlan(row.fillPlanJson),
    pending: parsePendingActions(row.pendingActionsJson),
    warnings: parseWarnings(row.warningsJson),
  };
}
