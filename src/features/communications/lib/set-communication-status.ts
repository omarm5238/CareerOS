import { prisma } from "@/server/db/prisma";

import type { CommunicationStatus } from "@/generated/prisma/client";

import {
  assertCommunicationDraftOwnedByUser,
  CommunicationAccessError,
  isCommunicationStatus,
} from "./communication-permissions";

const ALLOWED_STATUS_UPDATES = ["DRAFT", "READY", "ARCHIVED"] as const satisfies readonly CommunicationStatus[];

export async function setCommunicationStatus(
  userId: string,
  draftId: string,
  status: unknown,
) {
  if (!isCommunicationStatus(status) || !ALLOWED_STATUS_UPDATES.includes(status as (typeof ALLOWED_STATUS_UPDATES)[number])) {
    throw new CommunicationAccessError(
      "INVALID_INPUT",
      "Status must be Draft, Ready, or Archived. Use Mark as Used for used communications.",
    );
  }

  const draft = await assertCommunicationDraftOwnedByUser(userId, draftId);

  if (status === "ARCHIVED") {
    const updated = await prisma.communicationDraft.update({
      where: { id: draft.id },
      data: {
        status: "ARCHIVED",
        archivedAt: draft.archivedAt ?? new Date(),
      },
      select: { id: true, status: true, archivedAt: true },
    });
    return {
      draftId: updated.id,
      status: updated.status,
      archivedAt: updated.archivedAt?.toISOString() ?? null,
      message: "Communication archived.",
    };
  }

  const updated = await prisma.communicationDraft.update({
    where: { id: draft.id },
    data: {
      status,
      archivedAt: null,
    },
    select: { id: true, status: true },
  });

  return {
    draftId: updated.id,
    status: updated.status,
    message: status === "READY" ? "Marked Ready." : "Returned to Draft.",
  };
}

export async function archiveCommunication(userId: string, draftId: string) {
  return setCommunicationStatus(userId, draftId, "ARCHIVED");
}
