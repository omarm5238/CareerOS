import { prisma } from "@/server/db/prisma";

import type { ApplicationEventType, ApplicationStatus } from "@/generated/prisma/client";

import type { ApplicationRejectionSource } from "@/generated/prisma/client";
import {
  ApplicationAccessError,
  assertApplicationOwnedByUser,
  isApplicationRejectionSource,
} from "./application-permissions";
import {
  APPLICATION_STATUS_LABELS,
  canTransition,
  isClosedApplicationStatus,
} from "./application-state";
import { buildApplicationSnapshot } from "./build-application-snapshot";
import { recordApplicationEvent } from "./create-application-event";
import { toPrismaJson } from "./json-parsers";
import { syncLegacyJobApplicationFields } from "./legacy-application-compatibility";

export type TransitionApplicationStatusInput = {
  userId: string;
  applicationId: string;
  toStatus: ApplicationStatus;
  /** Optional explicit submission time when marking APPLIED. */
  appliedAt?: string | null;
  confirmedRejectionReason?: string | null;
  confirmedRejectionSource?: string | null;
  note?: string | null;
};

export type TransitionApplicationStatusResult = {
  applicationId: string;
  status: ApplicationStatus;
  appliedAt: string | null;
  resumeVersionMarkedUsed: boolean;
  /** True when the requested status already matched; no duplicate event written. */
  unchanged: boolean;
};

const CLOSING_EVENT_TYPES: Partial<Record<ApplicationStatus, ApplicationEventType>> = {
  REJECTED: "REJECTION_RECORDED",
  WITHDRAWN: "WITHDRAWN",
  OFFER: "OFFER_RECEIVED",
};

const MEANINGFUL_MEMORY_STATUSES = new Set<ApplicationStatus>([
  "APPLIED",
  "SCREENING",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "ACCEPTED",
]);

/**
 * Deterministic state machine for application stage changes.
 *
 * Everything here is one transaction: status, timestamps, timeline event and the
 * resume-version USED marker commit together or not at all. AI enrichment is
 * intentionally not part of this function so a model outage can never prevent a
 * user from recording what happened with their application.
 */
export async function transitionApplicationStatus(
  input: TransitionApplicationStatusInput,
): Promise<TransitionApplicationStatusResult> {
  const application = await assertApplicationOwnedByUser(input.userId, input.applicationId);

  // Idempotency: repeated clicks must not append duplicate status events.
  if (application.status === input.toStatus) {
    return {
      applicationId: application.id,
      status: application.status,
      appliedAt: application.appliedAt?.toISOString() ?? null,
      resumeVersionMarkedUsed: false,
      unchanged: true,
    };
  }

  if (isClosedApplicationStatus(application.status)) {
    throw new ApplicationAccessError(
      "CONFLICT",
      `This application is already closed as ${APPLICATION_STATUS_LABELS[application.status]}.`,
    );
  }

  if (!canTransition(application.status, input.toStatus)) {
    throw new ApplicationAccessError(
      "INVALID_INPUT",
      `Cannot move from ${APPLICATION_STATUS_LABELS[application.status]} to ${
        APPLICATION_STATUS_LABELS[input.toStatus]
      }.`,
    );
  }

  const now = new Date();
  const isSubmitting = input.toStatus === "APPLIED";

  let appliedAt = application.appliedAt;
  if (isSubmitting) {
    if (input.appliedAt) {
      const parsed = new Date(input.appliedAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new ApplicationAccessError("INVALID_INPUT", "Provide a valid applied date.");
      }
      appliedAt = parsed;
    } else {
      appliedAt = appliedAt ?? now;
    }
  }

  let rejectionSource: ApplicationRejectionSource | null = null;
  const rejectionReason = input.confirmedRejectionReason?.trim() || null;

  if (input.toStatus === "REJECTED" && input.confirmedRejectionSource) {
    if (!isApplicationRejectionSource(input.confirmedRejectionSource)) {
      throw new ApplicationAccessError("INVALID_INPUT", "Invalid rejection reason source.");
    }
    rejectionSource = input.confirmedRejectionSource;
  }

  // The submission snapshot is finalized exactly once, at APPLIED. Later job or
  // resume edits must never rewrite what was historically submitted.
  const finalSnapshot = isSubmitting
    ? await buildApplicationSnapshot({
        userId: input.userId,
        jobPostingId: application.jobPostingId,
        resumeVersionId: application.resumeVersionId,
        resumeVersionRevisionId: application.resumeVersionRevisionId,
        submittedAt: (appliedAt ?? now).toISOString(),
      })
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: application.id },
      data: {
        status: input.toStatus,
        lastActivityAt: now,
        ...(isSubmitting ? { appliedAt } : {}),
        ...(finalSnapshot ? { contextSnapshotJson: toPrismaJson(finalSnapshot) } : {}),
        ...(input.toStatus === "REJECTED"
          ? {
              rejectedAt: now,
              closedAt: now,
              confirmedRejectionReason: rejectionReason,
              confirmedRejectionSource: rejectionReason ? rejectionSource : null,
            }
          : {}),
        ...(input.toStatus === "ACCEPTED" || input.toStatus === "WITHDRAWN"
          ? { closedAt: now }
          : {}),
        ...(isClosedApplicationStatus(input.toStatus)
          ? {
              nextActionType: input.toStatus === "REJECTED" ? "REVIEW_REJECTION" : null,
              nextActionTitle:
                input.toStatus === "REJECTED" ? "Review this rejection" : null,
              nextActionReason:
                input.toStatus === "REJECTED"
                  ? "Compare the job requirements against the exact resume revision that was submitted."
                  : null,
              nextActionDueAt: null,
              nextActionSource: input.toStatus === "REJECTED" ? "RULE_BASED" : null,
            }
          : {}),
      },
      select: { id: true, status: true, appliedAt: true },
    });

    await recordApplicationEvent(tx, {
      applicationId: application.id,
      userId: input.userId,
      type: "STATUS_CHANGED",
      source: "SYSTEM",
      title: `Moved to ${APPLICATION_STATUS_LABELS[input.toStatus]}`,
      description: input.note?.trim() || null,
      fromStatus: application.status,
      toStatus: input.toStatus,
      eventAt: now,
    });

    if (isSubmitting) {
      await recordApplicationEvent(tx, {
        applicationId: application.id,
        userId: input.userId,
        type: "SUBMITTED",
        source: "USER",
        title: "Application submitted",
        description: finalSnapshot?.resume.resumeVersionTitle
          ? `Submitted with ${finalSnapshot.resume.resumeVersionTitle} · Revision ${
              finalSnapshot.resume.revisionNumber ?? "?"
            }`
          : "No CareerOS resume revision was recorded for this submission.",
        eventAt: appliedAt ?? now,
      });
    }

    const closingEvent = CLOSING_EVENT_TYPES[input.toStatus];
    if (closingEvent) {
      await recordApplicationEvent(tx, {
        applicationId: application.id,
        userId: input.userId,
        type: closingEvent,
        source: "USER",
        title:
          input.toStatus === "REJECTED"
            ? "Rejection recorded"
            : input.toStatus === "WITHDRAWN"
              ? "Application withdrawn"
              : "Offer received",
        description:
          input.toStatus === "REJECTED"
            ? (rejectionReason ?? "No confirmed rejection reason was recorded.")
            : (input.note?.trim() || null),
        eventAt: now,
      });
    }

    // USED is historical usage evidence: once a version has been submitted it
    // stays USED even if the application is later rejected.
    let markedUsed = false;
    if (isSubmitting && application.resumeVersionId) {
      const version = await tx.resumeVersion.findFirst({
        where: { id: application.resumeVersionId, userId: input.userId },
        select: { id: true, status: true },
      });

      if (version && version.status !== "USED" && version.status !== "ARCHIVED") {
        await tx.resumeVersion.update({
          where: { id: version.id },
          data: { status: "USED" },
        });
        markedUsed = true;
      }
    }

    await syncLegacyJobApplicationFields(tx, {
      userId: input.userId,
      jobPostingId: application.jobPostingId,
      status: input.toStatus,
      appliedAt: isSubmitting ? (appliedAt ?? now) : null,
    });

    return { updated, markedUsed };
  });

  if (isSubmitting) {
    const { tryRecordMeaningfulCareerActivity } = await import(
      "@/features/daily-roadmap/activity/record-activity"
    );
    await tryRecordMeaningfulCareerActivity({
      userId: input.userId,
      activityType: "APPLICATION_SUBMITTED",
      fingerprint: `APPLICATION_SUBMITTED:${result.updated.id}:APPLIED`,
      sourceEntityType: "APPLICATION",
      sourceEntityId: result.updated.id,
      occurredAt: result.updated.appliedAt ?? now,
    });
  }

  if (MEANINGFUL_MEMORY_STATUSES.has(result.updated.status)) {
    const { ingestCareerMemorySafe } = await import("@/features/career-memory/ingestion/refresh");
    await ingestCareerMemorySafe(input.userId, "EVENT_DRIVEN");
  }

  return {
    applicationId: result.updated.id,
    status: result.updated.status,
    appliedAt: result.updated.appliedAt?.toISOString() ?? null,
    resumeVersionMarkedUsed: result.markedUsed,
    unchanged: false,
  };
}
