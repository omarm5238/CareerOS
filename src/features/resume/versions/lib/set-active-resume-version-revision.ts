import { prisma } from "@/server/db/prisma";

import { activateResumeVersionRevision } from "./activate-resume-version-revision";
import {
  assertResumeVersionOwnedByUser,
  assertResumeVersionRevisionOwnedByUser,
  ResumeVersionAccessError,
} from "./resume-version-permissions";

export async function setActiveResumeVersionRevision(
  userId: string,
  versionId: string,
  revisionId: string,
) {
  await assertResumeVersionOwnedByUser(userId, versionId);
  await assertResumeVersionRevisionOwnedByUser(userId, versionId, revisionId);

  return prisma.$transaction(async (tx) => {
    const revision = await tx.resumeVersionRevision.findFirst({
      where: { id: revisionId, resumeVersionId: versionId, userId },
      select: { id: true, alignmentScoreBefore: true, alignmentScoreAfter: true },
    });

    if (!revision) {
      throw new ResumeVersionAccessError(
        "NOT_FOUND",
        "Resume version revision not found for this user.",
      );
    }

    return activateResumeVersionRevision(tx, versionId, revision);
  });
}
