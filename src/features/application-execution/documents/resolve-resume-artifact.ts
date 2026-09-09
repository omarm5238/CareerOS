import { prisma } from "@/server/db/prisma";

import { parseResumeVersionContent } from "@/features/resume/versions/lib/json-parsers";

import { ExecutionAccessError } from "../lib/permissions";
import { hashUploadArtifact, renderPlainTextPdf, writeUploadArtifact } from "./hash-upload-artifact";

export async function resolveResumeArtifact(input: {
  userId: string;
  resumeVersionRevisionId: string;
}) {
  const revision = await prisma.resumeVersionRevision.findFirst({
    where: { id: input.resumeVersionRevisionId, userId: input.userId },
    include: { resumeVersion: { select: { activeRevisionId: true, title: true } } },
  });
  if (!revision) {
    throw new ExecutionAccessError("NOT_FOUND", "Exact resume revision is missing.");
  }

  const content = parseResumeVersionContent(revision.contentJson);
  const lines = [
    content.summary,
    `Skills: ${content.coreSkills.join(", ")}`,
    ...content.experienceBullets.map((item) => item.tailored),
    ...content.education,
  ].filter(Boolean);
  const buffer = renderPlainTextPdf(revision.resumeVersion.title || "Resume", lines);
  const fileHash = hashUploadArtifact(buffer);
  const fileName = `resume-revision-${revision.id.slice(0, 8)}.pdf`;
  const filePath = await writeUploadArtifact(fileName, buffer);

  return {
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    activeRevisionId: revision.resumeVersion.activeRevisionId,
    usedActiveRevision: revision.resumeVersion.activeRevisionId === revision.id,
    fileHash,
    fileName,
    filePath,
    mimeType: "application/pdf",
  };
}
