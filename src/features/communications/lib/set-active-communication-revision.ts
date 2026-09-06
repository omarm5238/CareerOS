import { prisma } from "@/server/db/prisma";

import { activateCommunicationRevision } from "./activate-communication-revision";
import {
  assertCommunicationDraftOwnedByUser,
  assertCommunicationRevisionOwnedByUser,
} from "./communication-permissions";

export async function setActiveCommunicationRevision(
  userId: string,
  draftId: string,
  revisionId: string,
) {
  await assertCommunicationDraftOwnedByUser(userId, draftId);
  const revision = await assertCommunicationRevisionOwnedByUser(userId, revisionId, draftId);

  await prisma.$transaction(async (tx) => {
    await activateCommunicationRevision(tx, draftId, userId, revision);
  });

  return {
    draftId,
    activeRevisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    message: `Revision ${revision.revisionNumber} is now active.`,
  };
}
