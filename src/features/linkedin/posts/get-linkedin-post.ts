import { prisma } from "@/server/db/prisma";

import { LinkedinAccessError } from "../lib/permissions";
import { toPostView } from "../lib/views";

export async function getLinkedinPost(userId: string, postId: string) {
  const row = await prisma.linkedinPost.findFirst({
    where: { id: postId, userId },
    include: {
      pillar: true,
      activeRevision: true,
      revisions: { orderBy: { revisionNumber: "asc" } },
      publishingPlans: { include: { linkedinPostRevision: true }, orderBy: { createdAt: "desc" } },
      performances: { orderBy: { capturedAt: "desc" } },
    },
  });
  if (!row) throw new LinkedinAccessError("NOT_FOUND", "LinkedIn post not found.");
  return toPostView(row);
}

export async function listLinkedinPosts(userId: string) {
  const rows = await prisma.linkedinPost.findMany({
    where: { userId, status: { not: "ARCHIVED" } },
    include: {
      pillar: true,
      activeRevision: true,
      publishingPlans: {
        include: { linkedinPostRevision: true },
        orderBy: { createdAt: "desc" },
        take: 2,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(toPostView);
}
