import type { Prisma } from "@/generated/prisma/client";

import { CommunicationAccessError } from "./communication-permissions";

type ActivatableRevision = {
  id: string;
  userId: string;
  communicationDraftId: string;
};

export async function activateCommunicationRevision(
  tx: Prisma.TransactionClient,
  draftId: string,
  userId: string,
  revision: ActivatableRevision,
) {
  if (revision.userId !== userId || revision.communicationDraftId !== draftId) {
    throw new CommunicationAccessError(
      "FORBIDDEN",
      "That revision does not belong to this communication draft.",
    );
  }

  const draft = await tx.communicationDraft.findFirst({
    where: { id: draftId, userId },
    select: { id: true },
  });

  if (!draft) {
    throw new CommunicationAccessError("NOT_FOUND", "Communication draft not found.");
  }

  return tx.communicationDraft.update({
    where: { id: draftId },
    data: { activeRevisionId: revision.id },
  });
}
