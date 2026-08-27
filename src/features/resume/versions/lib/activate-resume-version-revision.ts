import type { Prisma } from "@/generated/prisma/client";

type ActivatableRevision = {
  id: string;
  alignmentScoreBefore: number | null;
  alignmentScoreAfter: number | null;
};

/**
 * Points a resume version at a revision and mirrors that revision's alignment
 * scores onto the container. The active revision is the only source of truth for
 * the container summary, so a null revision score must clear the container value
 * rather than leave the previous revision's number behind.
 */
export function activateResumeVersionRevision(
  tx: Prisma.TransactionClient,
  resumeVersionId: string,
  revision: ActivatableRevision,
) {
  return tx.resumeVersion.update({
    where: { id: resumeVersionId },
    data: {
      activeRevisionId: revision.id,
      alignmentScoreBefore: revision.alignmentScoreBefore,
      alignmentScoreAfter: revision.alignmentScoreAfter,
    },
  });
}
