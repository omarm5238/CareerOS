import { prisma } from "@/server/db/prisma";

import { ExecutionAccessError } from "../lib/permissions";
import { hashUploadArtifact, renderPlainTextPdf, writeUploadArtifact } from "./hash-upload-artifact";

export async function resolveCoverLetterArtifact(input: {
  userId: string;
  coverLetterDraftId: string;
  lockedRevisionId?: string | null;
}) {
  if (!input.lockedRevisionId) {
    throw new ExecutionAccessError("CONFLICT", "Exact approved cover letter revision is missing.");
  }

  const revision = await prisma.communicationDraftRevision.findFirst({
    where: {
      id: input.lockedRevisionId,
      communicationDraftId: input.coverLetterDraftId,
      userId: input.userId,
    },
    include: { communicationDraft: { select: { activeRevisionId: true } } },
  });
  if (!revision) {
    throw new ExecutionAccessError("NOT_FOUND", "Exact cover letter revision is missing.");
  }

  const buffer = renderPlainTextPdf(revision.subject || "Cover letter", revision.content.split("\n"));
  const fileHash = hashUploadArtifact(buffer);
  const fileName = `cover-letter-revision-${revision.id.slice(0, 8)}.pdf`;
  const filePath = await writeUploadArtifact(fileName, buffer);

  return {
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    activeRevisionId: revision.communicationDraft.activeRevisionId,
    fileHash,
    fileName,
    filePath,
    mimeType: "application/pdf",
  };
}
