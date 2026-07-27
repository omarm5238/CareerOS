import { prisma } from "@/server/db/prisma";

export type DeleteResumeDocumentResult =
  | { ok: true; nextDocumentId: string | null }
  | { ok: false; reason: "not_found" };

export async function deleteResumeDocumentForUser(
  userId: string,
  documentId: string,
): Promise<DeleteResumeDocumentResult> {
  const existing = await prisma.resumeDocument.findFirst({
    where: { id: documentId, userId },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  await prisma.resumeDocument.delete({
    where: { id: existing.id },
  });

  const next = await prisma.resumeDocument.findFirst({
    where: {
      userId,
      analysis: { isNot: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return { ok: true, nextDocumentId: next?.id ?? null };
}
