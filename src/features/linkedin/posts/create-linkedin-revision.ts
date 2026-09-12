import { prisma } from "@/server/db/prisma";
import type { LinkedinPostRevisionSource, Prisma } from "@/generated/prisma/client";

import { toPrismaJson } from "../lib/json-parsers";
import { assertOwnedPost, isLanguage, isTone, LinkedinAccessError } from "../lib/permissions";
import type { LinkedinEvidenceItem, LinkedinWarning } from "../types";

export type CreateRevisionInput = {
  userId: string;
  postId: string;
  source: LinkedinPostRevisionSource;
  hook: string;
  body: string;
  cta?: string | null;
  tone?: string;
  language?: string;
  hashtags?: string[];
  mentions?: string[];
  evidence?: LinkedinEvidenceItem[];
  warnings?: LinkedinWarning[];
  sourceContextSnapshot?: Record<string, unknown>;
  qaStatus?: "PASS" | "NEEDS_REVIEW" | "BLOCKED" | null;
  qaFingerprint?: string | null;
  generationStatus?: "PENDING" | "COMPLETED" | "FAILED";
  aiSource?: string | null;
  model?: string | null;
};

export async function createLinkedinRevision(input: CreateRevisionInput) {
  const post = await assertOwnedPost(input.userId, input.postId);
  const hook = input.hook.trim();
  const body = input.body.trim();
  if (!hook || !body) {
    throw new LinkedinAccessError("INVALID_INPUT", "Hook and body are required.");
  }

  return prisma.$transaction(async (tx) => {
    const latest = await tx.linkedinPostRevision.findFirst({
      where: { linkedinPostId: post.id },
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    });
    const revision = await tx.linkedinPostRevision.create({
      data: {
        userId: input.userId,
        linkedinPostId: post.id,
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        source: input.source,
        hook,
        body,
        cta: input.cta?.trim() || null,
        tone: isTone(input.tone) ? input.tone : post.activeRevision?.tone ?? "PROFESSIONAL",
        language: isLanguage(input.language)
          ? input.language
          : post.activeRevision?.language ?? "ENGLISH",
        hashtagsJson: toPrismaJson((input.hashtags ?? []).slice(0, 3)),
        mentionsJson: toPrismaJson((input.mentions ?? []).slice(0, 3)),
        evidenceJson: toPrismaJson(input.evidence ?? []),
        sourceContextSnapshotJson: toPrismaJson(input.sourceContextSnapshot ?? {}),
        warningsJson: toPrismaJson(input.warnings ?? []),
        qaStatus: input.qaStatus ?? null,
        qaFingerprint: input.qaFingerprint ?? null,
        generationStatus: input.generationStatus ?? "COMPLETED",
        aiSource: input.aiSource ?? null,
        model: input.model ?? null,
      },
    });

    await tx.linkedinPost.update({
      where: { id: post.id },
      data: {
        activeRevisionId: revision.id,
        status: post.status === "READY" || post.status === "SCHEDULED" ? "REVIEW" : post.status,
      },
    });

    return revision;
  });
}

export type LinkedinTx = Prisma.TransactionClient;
