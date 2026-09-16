import { prisma } from "@/server/db/prisma";

import { activityFingerprint } from "../lib/fingerprint";
import { getSafeLinkedinConnection } from "@/features/linkedin/server";
import { recordMeaningfulCareerActivity } from "../activity/record-activity";
import type { dailyRoadmapAction } from "@/generated/prisma/client";

export async function reconcileDailyRoadmap(userId: string, roadmapId: string) {
  const roadmap = await prisma.dailyRoadmap.findFirst({
    where: { id: roadmapId, userId },
    include: { actions: true },
  });
  if (!roadmap) return null;

  const now = new Date();
  const connection = await getSafeLinkedinConnection(userId);

  for (const action of roadmap.actions) {
    if (action.status === "COMPLETED" || action.status === "SKIPPED" || action.status === "EXPIRED") {
      continue;
    }

    const next = await inspectDomainCompletion(userId, action, connection.status);
    if (!next) continue;

    await prisma.dailyRoadmapAction.update({
      where: { id: action.id },
      data: {
        status: next.status,
        completedAt: next.status === "COMPLETED" ? now : action.completedAt,
        completionSource: next.status === "COMPLETED" ? "DOMAIN_EVENT" : action.completionSource,
        blockedReason: next.blockedReason ?? action.blockedReason,
      },
    });

    if (next.status === "COMPLETED" && action.isMeaningful) {
      await recordMeaningfulCareerActivity({
        userId,
        activityType: "ROADMAP_ACTION_COMPLETED",
        fingerprint: activityFingerprint(["ROADMAP_ACTION_COMPLETED", action.id]),
        sourceEntityType: action.sourceEntityType,
        sourceEntityId: action.sourceEntityId,
        minutes: action.estimatedMinutes,
        occurredAt: now,
        timezone: roadmap.timezone,
      });
    }
  }

  return prisma.dailyRoadmap.findFirst({
    where: { id: roadmapId, userId },
    include: { actions: { orderBy: { sortOrder: "asc" } } },
  });
}

async function inspectDomainCompletion(
  userId: string,
  action: dailyRoadmapAction,
  connectionStatus: string,
): Promise<{ status: "COMPLETED" | "EXPIRED" | "BLOCKED"; blockedReason?: string } | null> {
  if (action.type === "JOB_APPLY" && action.sourceEntityType === "APPLICATION" && action.sourceEntityId) {
    const application = await prisma.application.findFirst({
      where: { id: action.sourceEntityId, userId },
      select: { status: true },
    });
    if (!application) return { status: "EXPIRED" };
    if (application.status !== "DRAFT") return { status: "COMPLETED" };
  }

  if (action.type === "JOB_APPLY" && action.sourceEntityType === "JOB" && action.sourceEntityId) {
    const application = await prisma.application.findFirst({
      where: {
        userId,
        OR: [{ jobPostingId: action.sourceEntityId }, { id: action.sourceEntityId }],
        status: { not: "DRAFT" },
      },
      select: { id: true, status: true },
    });
    if (application) return { status: "COMPLETED" };

    const job = await prisma.discoveredJob.findFirst({
      where: { userId, OR: [{ id: action.sourceEntityId }, { jobPostingId: action.sourceEntityId }] },
      select: { expiresAt: true, dismissedAt: true, discoveryStatus: true },
    });
    if (job?.dismissedAt || job?.discoveryStatus === "DISMISSED") return { status: "EXPIRED" };
    if (job?.expiresAt && job.expiresAt.getTime() < Date.now()) return { status: "EXPIRED" };
  }

  if (action.type === "RESUME_REVIEW" && action.sourceEntityId) {
    const version = await prisma.resumeVersion.findFirst({
      where: { id: action.sourceEntityId, userId },
      select: { status: true },
    });
    if (!version) return { status: "EXPIRED" };
    if (version.status === "READY" || version.status === "USED") return { status: "COMPLETED" };
    if (version.status === "ARCHIVED") return { status: "EXPIRED" };
  }

  if (action.type === "COMMUNICATION_REVIEW" && action.sourceEntityId) {
    const draft = await prisma.communicationDraft.findFirst({
      where: { id: action.sourceEntityId, userId },
      select: { status: true, archivedAt: true },
    });
    if (!draft || draft.archivedAt) return { status: "EXPIRED" };
    if (draft.status === "USED") return { status: "COMPLETED" };
  }

  if (action.type === "LINKEDIN_PUBLISH" && action.sourceEntityId) {
    const plan = await prisma.linkedinPublishingPlan.findFirst({
      where: { id: action.sourceEntityId, userId },
      include: { linkedinPost: { select: { status: true } } },
    });
    if (!plan) return { status: "EXPIRED" };
    if (plan.status === "PUBLISHED" || plan.linkedinPost.status === "PUBLISHED") return { status: "COMPLETED" };
    if (plan.status === "CANCELLED" || plan.status === "STALE") return { status: "EXPIRED" };
    if (connectionStatus === "REAUTH_REQUIRED") {
      return { status: "BLOCKED", blockedReason: "LinkedIn authorization needs renewal." };
    }
  }

  if (action.type === "LINKEDIN_RECONNECT") {
    if (connectionStatus === "CONNECTED") return { status: "COMPLETED" };
  }

  if ((action.type === "JOB_REVIEW" || action.type === "JOB_PREPARE") && action.sourceEntityId) {
    const job = await prisma.discoveredJob.findFirst({
      where: { userId, OR: [{ id: action.sourceEntityId }, { jobPostingId: action.sourceEntityId }] },
      select: { expiresAt: true, dismissedAt: true, discoveryStatus: true },
    });
    if (job?.dismissedAt || job?.discoveryStatus === "DISMISSED") return { status: "EXPIRED" };
    if (job?.expiresAt && job.expiresAt.getTime() < Date.now()) return { status: "EXPIRED" };
  }

  return null;
}
