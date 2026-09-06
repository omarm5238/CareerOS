import { prisma } from "@/server/db/prisma";

import type { CommunicationDraftListItem, CommunicationResumeOption } from "../types";
import { assertJobOwnedByUser } from "./communication-permissions";
import { mapDraftListItem } from "./map-communication-draft";

export async function getJobCommunications(
  userId: string,
  jobPostingId: string,
): Promise<CommunicationDraftListItem[]> {
  await assertJobOwnedByUser(userId, jobPostingId);

  const drafts = await prisma.communicationDraft.findMany({
    where: {
      userId,
      jobPostingId,
      applicationId: null,
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      type: true,
      status: true,
      updatedAt: true,
      contact: { select: { name: true } },
      jobPosting: { select: { title: true, company: true } },
      activeRevision: {
        select: {
          language: true,
          revisionNumber: true,
          contextSnapshotJson: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  return drafts.map(mapDraftListItem);
}

export async function getJobResumeOptionsForCommunication(
  userId: string,
  jobPostingId: string,
): Promise<CommunicationResumeOption[]> {
  await assertJobOwnedByUser(userId, jobPostingId);

  const versions = await prisma.resumeVersion.findMany({
    where: {
      userId,
      targetJobId: jobPostingId,
      archivedAt: null,
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      title: true,
      status: true,
      activeRevisionId: true,
      activeRevision: {
        select: { id: true, revisionNumber: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return versions
    .filter((version) => version.activeRevision)
    .map((version) => ({
      versionId: version.id,
      versionTitle: version.title,
      versionStatus: version.status,
      revisionId: version.activeRevision!.id,
      revisionNumber: version.activeRevision!.revisionNumber,
    }));
}
