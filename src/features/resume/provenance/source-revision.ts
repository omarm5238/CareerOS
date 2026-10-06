import { Prisma } from "@/generated/prisma/client";
import { ResumeAnalysisFreshness, ResumeStaleReason } from "@/generated/prisma/enums";

import { hashResumeContent } from "./hash-resume-content";

type ResumeTx = Prisma.TransactionClient;

export async function lockResumeRevisions(tx: ResumeTx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
}

export async function findOrCreateSourceRevision(
  tx: ResumeTx,
  input: {
    userId: string;
    resumeDocumentId: string;
    sourceFilename: string;
    fullText: string;
  },
) {
  const contentHash = hashResumeContent(input.fullText);
  await lockResumeRevisions(tx, input.userId);
  const existing = await tx.resumeSourceRevision.findFirst({
    where: { userId: input.userId, contentHash },
  });
  if (existing) {
    return { revision: existing, contentHash, reused: true };
  }

  const max = await tx.resumeSourceRevision.aggregate({
    where: { userId: input.userId },
    _max: { revisionNumber: true },
  });
  const revision = await tx.resumeSourceRevision.create({
    data: {
      userId: input.userId,
      resumeDocumentId: input.resumeDocumentId,
      revisionNumber: (max._max.revisionNumber ?? 0) + 1,
      contentHash,
      sourceFilename: input.sourceFilename,
      isActive: false,
    },
  });
  return { revision, contentHash, reused: false };
}

export async function activateResumeSourceRevision(
  tx: ResumeTx,
  input: { userId: string; revisionId: string },
) {
  const revision = await tx.resumeSourceRevision.findFirst({
    where: { id: input.revisionId, userId: input.userId },
  });
  if (!revision) return null;
  if (revision.isActive) return { revision, changed: false as const };

  await tx.resumeSourceRevision.updateMany({
    where: { userId: input.userId, isActive: true },
    data: { isActive: false },
  });
  const activated = await tx.resumeSourceRevision.update({
    where: { id: revision.id },
    data: { isActive: true, activatedAt: new Date() },
  });
  return { revision: activated, changed: true as const };
}

export async function invalidateResumeDependents(
  tx: ResumeTx,
  input: {
    userId: string;
    revisionId: string;
    contentHash: string;
    keepAnalysisId: string;
    activeRevisionChanged: boolean;
  },
) {
  if (input.activeRevisionChanged) {
    await tx.resumeAnalysis.updateMany({
      where: {
        freshness: ResumeAnalysisFreshness.CURRENT,
        id: { not: input.keepAnalysisId },
        sourceRevisionId: { not: input.revisionId },
        resumeDocument: { userId: input.userId },
      },
      data: {
        freshness: ResumeAnalysisFreshness.STALE,
        staleReason: ResumeStaleReason.ACTIVE_REVISION_CHANGED,
      },
    });
  }

  await tx.resumeAnalysis.updateMany({
    where: {
      sourceRevisionId: input.revisionId,
      freshness: ResumeAnalysisFreshness.CURRENT,
      id: { not: input.keepAnalysisId },
    },
    data: {
      freshness: ResumeAnalysisFreshness.SUPERSEDED,
      staleReason: null,
    },
  });

  await tx.opportunityAnalysisSnapshot.updateMany({
    where: {
      userId: input.userId,
      status: { notIn: ["STALE", "FAILED"] },
      OR: [
        { resumeRevisionId: { not: input.revisionId } },
        { resumeContentHash: { not: input.contentHash } },
        { resumeAnalysisId: { not: input.keepAnalysisId } },
      ],
    },
    data: { status: "STALE" },
  });

  console.info(JSON.stringify({
    event: "resume_dependents_invalidated",
    userId: input.userId,
    revisionId: input.revisionId,
    analysisId: input.keepAnalysisId,
    activeRevisionChanged: input.activeRevisionChanged,
  }));
}
