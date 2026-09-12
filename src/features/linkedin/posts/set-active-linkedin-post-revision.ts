import { prisma } from "@/server/db/prisma";

import { assertOwnedPost, LinkedinAccessError } from "../lib/permissions";
import { getLinkedinPost } from "./get-linkedin-post";

export async function setActiveLinkedinPostRevision(userId: string, postId: string, revisionId: string) {
  const post = await assertOwnedPost(userId, postId);
  const revision = post.revisions.find((item) => item.id === revisionId);
  if (!revision || revision.userId !== userId) {
    throw new LinkedinAccessError("NOT_FOUND", "Revision not found.");
  }
  if (revision.linkedinPostId !== post.id) {
    throw new LinkedinAccessError("FORBIDDEN", "That revision does not belong to this post.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.linkedinPost.update({
      where: { id: post.id },
      data: {
        activeRevisionId: revision.id,
        status: post.status === "PUBLISHED" ? post.status : "REVIEW",
      },
    });
  });

  return getLinkedinPost(userId, postId);
}

export async function archiveLinkedinPost(userId: string, postId: string) {
  const post = await assertOwnedPost(userId, postId);
  await prisma.linkedinPost.update({
    where: { id: post.id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  return getLinkedinPost(userId, postId);
}
