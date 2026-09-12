import { prisma } from "@/server/db/prisma";

import { LinkedinAccessError } from "../lib/permissions";
import { toPlanView } from "../lib/views";
import { getLinkedinPost } from "../posts/get-linkedin-post";

export async function createLinkedinPublishingPlan(userId: string, postId: string, body: Record<string, unknown> = {}) {
  const post = await getLinkedinPost(userId, postId);
  if (post.status !== "READY" && post.status !== "SCHEDULED") {
    throw new LinkedinAccessError("CONFLICT", "A publishing plan can only be created from a READY post.");
  }
  if (!post.activeRevisionId || !post.activeRevision) {
    throw new LinkedinAccessError("INVALID_INPUT", "READY posts must have an exact active revision.");
  }

  const plannedPublishAt =
    typeof body.plannedPublishAt === "string" && body.plannedPublishAt
      ? new Date(body.plannedPublishAt)
      : null;

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.linkedinPublishingPlan.create({
      data: {
        userId,
        linkedinPostId: post.id,
        linkedinPostRevisionId: post.activeRevisionId!,
        status: plannedPublishAt ? "SCHEDULED" : "READY",
        publishMode: "MANUAL",
        plannedPublishAt,
        timezone: typeof body.timezone === "string" ? body.timezone : null,
        approvedAt: new Date(),
      },
      include: { linkedinPostRevision: true },
    });
    await tx.linkedinPost.update({
      where: { id: post.id },
      data: {
        status: plannedPublishAt ? "SCHEDULED" : post.status,
        plannedPublishAt,
      },
    });
    return plan;
  });

  return toPlanView(created, post.activeRevisionId);
}

export async function getLinkedinPublishingPlan(userId: string, planId: string) {
  const { assertOwnedPlan } = await import("../lib/permissions");
  const plan = await assertOwnedPlan(userId, planId);
  return toPlanView(plan, plan.linkedinPost.activeRevisionId);
}

export async function updateLinkedinPublishingPlan(userId: string, planId: string, body: Record<string, unknown>) {
  const { assertOwnedPlan } = await import("../lib/permissions");
  const plan = await assertOwnedPlan(userId, planId);
  if (plan.status === "PUBLISHED" || plan.status === "CANCELLED") {
    throw new LinkedinAccessError("CONFLICT", "Published or cancelled plans cannot be rewritten.");
  }
  const updated = await prisma.linkedinPublishingPlan.update({
    where: { id: plan.id },
    data: {
      plannedPublishAt:
        typeof body.plannedPublishAt === "string" ? new Date(body.plannedPublishAt) : plan.plannedPublishAt,
      timezone: typeof body.timezone === "string" ? body.timezone : plan.timezone,
      status: typeof body.plannedPublishAt === "string" ? "SCHEDULED" : plan.status,
    },
    include: { linkedinPostRevision: true, linkedinPost: true },
  });
  return toPlanView(updated, updated.linkedinPost.activeRevisionId);
}

export async function cancelLinkedinPublishingPlan(userId: string, planId: string) {
  const { assertOwnedPlan } = await import("../lib/permissions");
  const plan = await assertOwnedPlan(userId, planId);
  const updated = await prisma.linkedinPublishingPlan.update({
    where: { id: plan.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: { linkedinPostRevision: true, linkedinPost: true },
  });
  return toPlanView(updated, updated.linkedinPost.activeRevisionId);
}

export async function getReadyLinkedinPublishingPlan(userId: string, planId: string) {
  return getLinkedinPublishingPlan(userId, planId);
}

export function getPublishingRevision(plan: { linkedinPostRevisionId: string }) {
  return plan.linkedinPostRevisionId;
}
