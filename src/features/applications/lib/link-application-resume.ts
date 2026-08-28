import { prisma } from "@/server/db/prisma";

import {
  ApplicationAccessError,
  assertApplicationOwnedByUser,
  assertResumeLinkOwnedByUser,
} from "./application-permissions";
import { canChangeResumeLink } from "./application-state";
import { buildApplicationSnapshot } from "./build-application-snapshot";
import { recordApplicationEvent } from "./create-application-event";
import { toPrismaJson } from "./json-parsers";

export type LinkApplicationResumeInput = {
  userId: string;
  applicationId: string;
  resumeVersionId: string;
  resumeVersionRevisionId?: string | null;
};

/**
 * Changes the exact resume revision attached to an application.
 *
 * This is the only sanctioned path for that mutation and it refuses to run once
 * the application has been submitted, because the link is then historical
 * evidence of what was actually sent.
 */
export async function linkApplicationResume(input: LinkApplicationResumeInput) {
  const application = await assertApplicationOwnedByUser(input.userId, input.applicationId);

  if (!canChangeResumeLink(application.status)) {
    throw new ApplicationAccessError(
      "CONFLICT",
      "The resume is locked after submission. It records exactly what was sent to this employer.",
    );
  }

  const { version, revision } = await assertResumeLinkOwnedByUser(
    input.userId,
    input.resumeVersionId,
    input.resumeVersionRevisionId,
  );

  const alreadyLinked =
    application.resumeVersionId === version.id &&
    application.resumeVersionRevisionId === revision.id;

  const snapshot = await buildApplicationSnapshot({
    userId: input.userId,
    jobPostingId: application.jobPostingId,
    resumeVersionId: version.id,
    resumeVersionRevisionId: revision.id,
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: application.id },
      data: {
        resumeVersionId: version.id,
        resumeVersionRevisionId: revision.id,
        contextSnapshotJson: toPrismaJson(snapshot),
        lastActivityAt: new Date(),
      },
      select: { id: true, resumeVersionId: true, resumeVersionRevisionId: true },
    });

    if (!alreadyLinked) {
      await recordApplicationEvent(tx, {
        applicationId: application.id,
        userId: input.userId,
        type: "RESUME_LINKED",
        source: "USER",
        title: "Resume changed",
        description: `${version.title} · Revision ${revision.revisionNumber}`,
      });
    }

    return updated;
  });
}
