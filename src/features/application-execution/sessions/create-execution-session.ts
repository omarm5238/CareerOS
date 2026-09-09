import { prisma } from "@/server/db/prisma";

import { ADAPTER_VERSION } from "../types";
import { ExecutionAccessError } from "../lib/permissions";
import { toPrismaJson } from "../lib/json-parsers";
import { ACTIVE_SESSION_STATUSES } from "./execution-state-machine";
import { recordExecutionEvent } from "./execution-event";
import { applyUrlFromJob } from "./load-owned-session";

const APPLIED_STATUSES = ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "ACCEPTED"] as const;

export async function createExecutionSession(userId: string, applicationPackageId: string) {
  const pkg = await prisma.applicationPackage.findFirst({
    where: { id: applicationPackageId, userId },
    include: {
      application: true,
      jobPosting: true,
    },
  });
  if (!pkg) throw new ExecutionAccessError("NOT_FOUND", "Application package not found.");
  if (pkg.status !== "APPROVED" && pkg.status !== "SUBMISSION_STARTED") {
    throw new ExecutionAccessError("CONFLICT", "Approve the package before starting assisted application.");
  }
  if (!pkg.applicationId || !pkg.application) {
    throw new ExecutionAccessError("CONFLICT", "A draft application is required.");
  }
  if (pkg.application.userId !== userId || pkg.application.id !== pkg.applicationId) {
    throw new ExecutionAccessError("NOT_FOUND", "Application package not found.");
  }
  if (!pkg.jobPostingId || !pkg.jobPosting || pkg.jobPosting.userId !== userId) {
    throw new ExecutionAccessError("NOT_FOUND", "Application package not found.");
  }
  if (pkg.application.jobPostingId && pkg.application.jobPostingId !== pkg.jobPostingId) {
    throw new ExecutionAccessError("CONFLICT", "Application and package job context do not match.");
  }
  if (pkg.application.status !== "DRAFT") {
    throw new ExecutionAccessError("CONFLICT", "Assisted execution requires an M22 DRAFT application.");
  }
  applyUrlFromJob(pkg.jobPosting.jobUrl);

  const duplicate = await prisma.application.findFirst({
    where: {
      userId,
      jobPostingId: pkg.jobPostingId,
      id: { not: pkg.applicationId },
      status: { in: [...APPLIED_STATUSES] },
    },
  });
  if (duplicate) {
    throw new ExecutionAccessError("CONFLICT", "Already applied");
  }

  const active = await prisma.applicationExecutionSession.findFirst({
    where: { userId, status: { in: ACTIVE_SESSION_STATUSES } },
  });
  if (active && active.applicationPackageId !== pkg.id) {
    throw new ExecutionAccessError("CONFLICT", "An assisted application is already running. Finish or cancel it first.");
  }
  if (active && active.applicationPackageId === pkg.id) {
    return {
      sessionId: active.id,
      status: active.status,
      executionMode: active.executionMode,
      reused: true,
    };
  }

  const lockedCoverLetterRevisionId: string | null = pkg.coverLetterRevisionId;
  if (pkg.coverLetterDraftId && !pkg.coverLetterRevisionId) {
    throw new ExecutionAccessError(
      "CONFLICT",
      "This approved package does not freeze an exact cover letter revision. Refresh and approve the package again.",
    );
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.applicationExecutionSession.create({
      data: {
        userId,
        applicationPackageId: pkg.id,
        applicationId: pkg.applicationId!,
        jobPostingId: pkg.jobPostingId!,
        provider: "UNKNOWN",
        adapterVersion: ADAPTER_VERSION,
        executionMode: "ASSISTED_BROWSER",
        status: "CREATED",
        fillPlanJson: toPrismaJson({
          answers: [],
          uploadedDocuments: [],
          lockedCoverLetterRevisionId,
        }),
      },
    });
    await recordExecutionEvent(tx, {
      userId,
      executionSessionId: created.id,
      type: "SESSION_CREATED",
      message: "Assisted application session created.",
      metadata: { applicationPackageId: pkg.id, applicationId: pkg.applicationId },
    });
    return created;
  });

  return {
    sessionId: session.id,
    status: session.status,
    executionMode: session.executionMode,
    reused: false,
  };
}
