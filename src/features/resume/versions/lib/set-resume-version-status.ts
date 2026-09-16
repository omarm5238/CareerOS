import { prisma } from "@/server/db/prisma";

import type { ResumeVersionStatus } from "@/generated/prisma/client";

import {
  assertResumeVersionOwnedByUser,
  isResumeVersionStatus,
  ResumeVersionAccessError,
} from "./resume-version-permissions";

/** USED is reserved for the Application Tracker and is not user-selectable yet. */
const USER_SELECTABLE_STATUSES: readonly ResumeVersionStatus[] = ["DRAFT", "READY", "ARCHIVED"];

type SetResumeVersionStatusOptions = {
  /** Set to true for internal callers that may move a version to USED. */
  allowReservedStatuses?: boolean;
};

export async function setResumeVersionStatus(
  userId: string,
  versionId: string,
  status: ResumeVersionStatus,
  options: SetResumeVersionStatusOptions = {},
) {
  const version = await assertResumeVersionOwnedByUser(userId, versionId);

  if (!isResumeVersionStatus(status)) {
    throw new ResumeVersionAccessError("INVALID_INPUT", "Invalid resume version status.");
  }

  if (!options.allowReservedStatuses && !USER_SELECTABLE_STATUSES.includes(status)) {
    throw new ResumeVersionAccessError(
      "INVALID_INPUT",
      "That status cannot be set manually.",
    );
  }

  if (status === "READY" && !version.activeRevisionId) {
    throw new ResumeVersionAccessError(
      "INVALID_INPUT",
      "This version has no active revision yet, so it cannot be marked ready.",
    );
  }

  const updated = await prisma.resumeVersion.update({
    where: { id: versionId },
    data: {
      status,
      archivedAt: status === "ARCHIVED" ? new Date() : null,
    },
  });

  if (status === "READY" && version.status !== "READY") {
    const { tryRecordMeaningfulCareerActivity } = await import(
      "@/features/daily-roadmap/activity/record-activity"
    );
    await tryRecordMeaningfulCareerActivity({
      userId,
      activityType: "RESUME_READY",
      fingerprint: `RESUME_READY:${updated.id}:${updated.activeRevisionId ?? "none"}`,
      sourceEntityType: "RESUME_VERSION",
      sourceEntityId: updated.id,
    });
  }

  return updated;
}
