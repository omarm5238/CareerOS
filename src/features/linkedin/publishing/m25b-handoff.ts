import { prisma } from "@/server/db/prisma";

import { LinkedinAccessError } from "../lib/permissions";
import { syncOfficialLinkedinPostAnalytics } from "../integration/analytics/sync-official-analytics";

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

export { executeLinkedinOfficialPublish as markPublishingPlanExternallyPublished } from "../integration/publishing/official-publish";
export { syncOfficialLinkedinPostAnalytics as upsertOfficialLinkedinPerformance };
