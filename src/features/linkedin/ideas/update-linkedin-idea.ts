import { prisma } from "@/server/db/prisma";

import { assertOwnedIdea, isIdeaStatus, LinkedinAccessError } from "../lib/permissions";
import { toIdeaView } from "../lib/views";

export async function updateLinkedinIdea(userId: string, ideaId: string, body: Record<string, unknown>) {
  const idea = await assertOwnedIdea(userId, ideaId);
  if (!isIdeaStatus(body.status)) {
    throw new LinkedinAccessError("INVALID_INPUT", "A valid idea status is required.");
  }
  if (idea.status === "ARCHIVED" && body.status !== "ARCHIVED") {
    throw new LinkedinAccessError("CONFLICT", "Archived ideas cannot be reused without a new generation.");
  }

  const updated = await prisma.linkedinContentIdea.update({
    where: { id: idea.id },
    data: {
      status: body.status,
      archivedAt: body.status === "ARCHIVED" || body.status === "DISMISSED" ? new Date() : idea.archivedAt,
    },
    include: { pillar: true },
  });
  return toIdeaView(updated);
}

export async function listLinkedinIdeas(userId: string) {
  const rows = await prisma.linkedinContentIdea.findMany({
    where: { userId, status: { notIn: ["ARCHIVED"] } },
    include: { pillar: true },
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: 40,
  });
  return rows.map((row) => toIdeaView(row));
}
