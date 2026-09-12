import { prisma } from "@/server/db/prisma";

import { LinkedinAccessError } from "../lib/permissions";
import { getLinkedinPost } from "./get-linkedin-post";
import { runLinkedinPostQa } from "./run-linkedin-post-qa";

export async function markLinkedinPostReady(userId: string, postId: string) {
  const post = await getLinkedinPost(userId, postId);
  if (!post.activeRevision) {
    throw new LinkedinAccessError("INVALID_INPUT", "READY requires an active revision.");
  }
  const qa = post.activeRevision.qaStatus
    ? { status: post.activeRevision.qaStatus, warnings: post.activeRevision.warnings }
    : await runLinkedinPostQa(userId, postId);

  if (qa.status === "BLOCKED") {
    throw new LinkedinAccessError("CONFLICT", "A blocked post cannot be marked READY.");
  }
  if (qa.warnings.some((item) => item.code.startsWith("unsupported_"))) {
    throw new LinkedinAccessError("CONFLICT", "Unresolved unsupported claims must be repaired first.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.linkedinPost.update({
      where: { id: post.id },
      data: { status: "READY" },
    });
  });

  return getLinkedinPost(userId, postId);
}
