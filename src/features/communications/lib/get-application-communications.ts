import { prisma } from "@/server/db/prisma";

import type { CommunicationDraftListItem, CommunicationRecommendation } from "../types";
import { assertApplicationOwnedByUser } from "./communication-permissions";
import { deriveCommunicationRecommendations } from "./derive-communication-recommendations";
import { mapDraftListItem } from "./map-communication-draft";

const LIST_SELECT = {
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
} as const;

export async function getApplicationCommunications(
  userId: string,
  applicationId: string,
  options?: { includeArchived?: boolean },
): Promise<CommunicationDraftListItem[]> {
  await assertApplicationOwnedByUser(userId, applicationId);

  const drafts = await prisma.communicationDraft.findMany({
    where: {
      userId,
      applicationId,
      ...(options?.includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    },
    select: LIST_SELECT,
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return drafts.map(mapDraftListItem);
}

export async function getApplicationCommunicationSection(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: {
      id: true,
      status: true,
      events: {
        select: { type: true, eventAt: true },
        orderBy: { eventAt: "desc" },
        take: 40,
      },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          role: true,
          company: true,
          isPrimary: true,
        },
      },
      resumeVersionId: true,
      resumeVersionRevisionId: true,
      resumeVersion: { select: { title: true, status: true } },
      resumeVersionRevision: { select: { revisionNumber: true } },
      jobPosting: { select: { title: true, company: true } },
    },
  });

  if (!application) return null;

  const [drafts, archivedCount] = await Promise.all([
    getApplicationCommunications(userId, applicationId),
    prisma.communicationDraft.count({
      where: { userId, applicationId, status: "ARCHIVED" },
    }),
  ]);

  const recommendations: CommunicationRecommendation[] = deriveCommunicationRecommendations({
    status: application.status,
    events: application.events,
  });

  return {
    applicationId: application.id,
    status: application.status,
    jobTitle: application.jobPosting?.title ?? null,
    company: application.jobPosting?.company ?? null,
    resumeVersionId: application.resumeVersionId,
    resumeVersionRevisionId: application.resumeVersionRevisionId,
    resumeVersionTitle: application.resumeVersion?.title ?? null,
    resumeVersionStatus: application.resumeVersion?.status ?? null,
    resumeRevisionNumber: application.resumeVersionRevision?.revisionNumber ?? null,
    contacts: application.contacts,
    recommendations,
    drafts,
    archivedCount,
    interviewCompleted: application.events.some((event) => event.type === "INTERVIEW_COMPLETED"),
  };
}
