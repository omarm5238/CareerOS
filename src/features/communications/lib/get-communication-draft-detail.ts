import { prisma } from "@/server/db/prisma";

import type { CommunicationDraftDetail } from "../types";
import { rebuildCurrentContextForDraft } from "./build-communication-context";
import { buildCommunicationContextFingerprint } from "./communication-context-fingerprint";
import { displayFromSnapshot, mapRevisionDetail, mapRevisionSummary } from "./map-communication-draft";

export async function getCommunicationDraftDetailForUser(
  userId: string,
  draftId: string,
): Promise<CommunicationDraftDetail | null> {
  const draft = await prisma.communicationDraft.findFirst({
    where: { id: draftId, userId },
    select: {
      id: true,
      applicationId: true,
      jobPostingId: true,
      contactId: true,
      resumeVersionId: true,
      resumeVersionRevisionId: true,
      type: true,
      status: true,
      usedAt: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      activeRevisionId: true,
      jobPosting: { select: { title: true, company: true, location: true } },
      contact: { select: { name: true, role: true } },
      application: { select: { status: true } },
      resumeVersion: { select: { status: true } },
      resumeVersionRevision: { select: { revisionNumber: true } },
      activeRevision: {
        select: {
          id: true,
          revisionNumber: true,
          source: true,
          subject: true,
          content: true,
          tone: true,
          length: true,
          language: true,
          contextSnapshotJson: true,
          contextFingerprint: true,
          evidenceUsedJson: true,
          warningsJson: true,
          changeLogJson: true,
          model: true,
          aiSource: true,
          generationStatus: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        select: {
          id: true,
          revisionNumber: true,
          source: true,
          subject: true,
          content: true,
          tone: true,
          length: true,
          language: true,
          contextSnapshotJson: true,
          contextFingerprint: true,
          evidenceUsedJson: true,
          warningsJson: true,
          changeLogJson: true,
          model: true,
          aiSource: true,
          generationStatus: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!draft) return null;

  const snapshotDisplay = draft.activeRevision
    ? displayFromSnapshot(draft.activeRevision.contextSnapshotJson)
    : null;

  let currentFingerprint: string | null = null;
  let contextStale = false;

  try {
    const current = await rebuildCurrentContextForDraft(userId, draft.id);
    currentFingerprint = buildCommunicationContextFingerprint(current);
    contextStale = Boolean(
      draft.activeRevision && draft.activeRevision.contextFingerprint !== currentFingerprint,
    );
  } catch {
    currentFingerprint = draft.activeRevision?.contextFingerprint ?? null;
    contextStale = false;
  }

  return {
    id: draft.id,
    applicationId: draft.applicationId,
    jobPostingId: draft.jobPostingId,
    contactId: draft.contactId,
    resumeVersionId: draft.resumeVersionId,
    resumeVersionRevisionId: draft.resumeVersionRevisionId,
    type: draft.type,
    status: draft.status,
    usedAt: draft.usedAt?.toISOString() ?? null,
    archivedAt: draft.archivedAt?.toISOString() ?? null,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    jobTitle: draft.jobPosting?.title ?? snapshotDisplay?.jobTitle ?? null,
    company: draft.jobPosting?.company ?? snapshotDisplay?.company ?? null,
    location: draft.jobPosting?.location ?? snapshotDisplay?.location ?? null,
    recipientName: draft.contact?.name ?? snapshotDisplay?.recipientName ?? null,
    recipientRole: draft.contact?.role ?? snapshotDisplay?.recipientRole ?? null,
    applicationStatus: draft.application?.status ?? snapshotDisplay?.applicationStatus ?? null,
    resumeRevisionNumber:
      draft.resumeVersionRevision?.revisionNumber ?? snapshotDisplay?.resumeRevisionNumber ?? null,
    resumeVersionStatus: draft.resumeVersion?.status ?? null,
    linkedToApplication: draft.applicationId !== null,
    activeRevision: draft.activeRevision ? mapRevisionDetail(draft.activeRevision) : null,
    revisions: draft.revisions.map((revision) =>
      mapRevisionSummary(revision, draft.activeRevisionId),
    ),
    contextStale,
    currentContextFingerprint: currentFingerprint,
  };
}
