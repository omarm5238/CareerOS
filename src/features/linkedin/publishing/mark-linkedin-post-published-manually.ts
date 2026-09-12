import { prisma } from "@/server/db/prisma";

import { assertOwnedPlan, LinkedinAccessError } from "../lib/permissions";
import { toPlanView } from "../lib/views";

export async function markLinkedinPostPublishedManually(
  userId: string,
  planId: string,
  body: Record<string, unknown> = {},
) {
  const plan = await assertOwnedPlan(userId, planId);
  if (plan.status === "CANCELLED") {
    throw new LinkedinAccessError("CONFLICT", "A cancelled plan cannot be marked published.");
  }

  if (plan.status === "PUBLISHED") {
    return {
      alreadyPublished: true,
      plan: toPlanView(plan, plan.linkedinPost.activeRevisionId),
      publishedAt: plan.publishedAt?.toISOString() ?? null,
      revisionId: plan.linkedinPostRevisionId,
    };
  }

  if (plan.status !== "READY" && plan.status !== "SCHEDULED" && plan.status !== "DRAFT") {
    throw new LinkedinAccessError("CONFLICT", "Only an explicit ready or scheduled plan can be marked published.");
  }

  const publishedAt = plan.publishedAt ?? new Date();
  const url = typeof body.externalLinkedInUrl === "string" ? body.externalLinkedInUrl.trim() : "";

  const updated = await prisma.$transaction(async (tx) => {
    const nextPlan = await tx.linkedinPublishingPlan.update({
      where: { id: plan.id },
      data: {
        status: "PUBLISHED",
        publishMode: "MANUAL",
        publishingSource: "USER_CONFIRMED",
        publishedAt,
      },
      include: { linkedinPostRevision: true, linkedinPost: true },
    });
    await tx.linkedinPost.update({
      where: { id: plan.linkedinPostId },
      data: {
        status: "PUBLISHED",
        publishedAt,
        publishingSource: "USER_CONFIRMED",
        externalLinkedInUrl: url || plan.linkedinPost.externalLinkedInUrl,
      },
    });
    return nextPlan;
  });

  return {
    alreadyPublished: false,
    plan: toPlanView(updated, updated.linkedinPost.activeRevisionId),
    publishedAt: updated.publishedAt?.toISOString() ?? publishedAt.toISOString(),
    revisionId: updated.linkedinPostRevisionId,
  };
}
