import { prisma } from "@/server/db/prisma";

import { recordApplicationEvent } from "@/features/applications/lib/create-application-event";

import { COMMUNICATION_TYPE_LABELS } from "../types";
import { assertCommunicationDraftOwnedByUser } from "./communication-permissions";

function usedEventTitle(type: keyof typeof COMMUNICATION_TYPE_LABELS): string {
  if (type === "FOLLOW_UP") return "Follow-up communication marked as used";
  return `${COMMUNICATION_TYPE_LABELS[type]} communication marked as used`;
}

export async function markCommunicationUsed(
  userId: string,
  draftId: string,
  options?: { recordTimelineEvent?: boolean },
) {
  const draft = await assertCommunicationDraftOwnedByUser(userId, draftId);
  const recordTimeline = options?.recordTimelineEvent === true;

  if (draft.status === "USED") {
    return {
      draftId: draft.id,
      status: draft.status,
      usedAt: draft.usedAt?.toISOString() ?? null,
      timelineEventCreated: false,
      message: "This communication is already marked as used.",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.communicationDraft.update({
      where: { id: draft.id },
      data: {
        status: "USED",
        usedAt: new Date(),
        archivedAt: null,
      },
      select: { id: true, status: true, usedAt: true, applicationId: true, type: true },
    });

    let timelineEventCreated = false;

    if (recordTimeline && updated.applicationId) {
      await recordApplicationEvent(tx, {
        applicationId: updated.applicationId,
        userId,
        type: updated.type === "FOLLOW_UP" ? "FOLLOW_UP_SENT" : "OTHER",
        source: "USER",
        title: usedEventTitle(updated.type),
        description:
          "The user marked this CareerOS communication draft as used externally. CareerOS did not send or deliver it.",
        metadata: {
          notes: `communicationDraftId=${updated.id}`,
        },
      });
      timelineEventCreated = true;

      await tx.application.update({
        where: { id: updated.applicationId },
        data: { lastActivityAt: new Date() },
      });
    }

    return { updated, timelineEventCreated };
  });

  return {
    draftId: result.updated.id,
    status: result.updated.status,
    usedAt: result.updated.usedAt?.toISOString() ?? null,
    timelineEventCreated: result.timelineEventCreated,
    message: "Marked as used.",
  };
}
