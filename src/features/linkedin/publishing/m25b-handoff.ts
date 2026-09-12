import { prisma } from "@/server/db/prisma";

import { LinkedinAccessError } from "../lib/permissions";

export async function getReadyLinkedinPublishingPlan(userId: string, planId: string) {
  const plan = await prisma.linkedinPublishingPlan.findFirst({
    where: { id: planId, userId, status: { in: ["READY", "SCHEDULED"] } },
  });
  if (!plan) throw new LinkedinAccessError("NOT_FOUND", "Ready publishing plan not found.");
  return plan;
}

export function getPublishingRevision(plan: { linkedinPostRevisionId: string }) {
  return plan.linkedinPostRevisionId;
}

export async function markPublishingPlanExternallyPublished(userId: string, planId: string) {
  throw new LinkedinAccessError(
    "CONFLICT",
    "M25A cannot mark a plan as LinkedIn-official. That belongs to M25B.",
  );
  void userId;
  void planId;
}

export async function upsertOfficialLinkedinPerformance() {
  throw new LinkedinAccessError(
    "CONFLICT",
    "M25A cannot upsert official LinkedIn analytics. That belongs to M25B.",
  );
}
