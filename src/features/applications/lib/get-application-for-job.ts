import { prisma } from "@/server/db/prisma";

import type { ApplicationStatus } from "@/generated/prisma/client";

import { SCHEDULED_EVENT_TYPES } from "../types";

export type JobApplicationSummary = {
  /** Current attempt, if one is open or being prepared. */
  current: {
    id: string;
    status: ApplicationStatus;
    appliedAt: string | null;
    followUpAt: string | null;
    nextActionTitle: string | null;
    resumeVersionTitle: string | null;
    revisionNumber: number | null;
    upcomingEventAt: string | null;
    upcomingEventTitle: string | null;
  } | null;
  /** Most recent closed attempt, shown only when there is no current attempt. */
  lastClosed: {
    id: string;
    status: ApplicationStatus;
    closedAt: string | null;
  } | null;
  totalAttempts: number;
};

/**
 * Application state for one job. A job may accumulate several attempts, so the
 * current attempt is resolved by priority rather than by taking the newest row.
 */
export async function getApplicationSummaryForJob(
  userId: string,
  jobPostingId: string,
): Promise<JobApplicationSummary> {
  const now = new Date();

  const applications = await prisma.application.findMany({
    where: { userId, jobPostingId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      appliedAt: true,
      followUpAt: true,
      closedAt: true,
      nextActionTitle: true,
      createdAt: true,
      resumeVersionRevision: { select: { revisionNumber: true } },
      resumeVersion: { select: { title: true } },
      events: {
        where: { type: { in: [...SCHEDULED_EVENT_TYPES] }, eventAt: { gte: now } },
        orderBy: { eventAt: "asc" },
        take: 1,
        select: { title: true, eventAt: true },
      },
    },
  });

  if (applications.length === 0) {
    return { current: null, lastClosed: null, totalAttempts: 0 };
  }

  const openAttempts = applications.filter((item) => item.closedAt === null);

  // Prefer a live attempt over a draft that is still being prepared.
  const activeAttempt = openAttempts.find((item) => item.status !== "DRAFT");
  const draftAttempt = openAttempts.find((item) => item.status === "DRAFT");
  const currentSource = activeAttempt ?? draftAttempt ?? null;

  const closedAttempts = applications.filter((item) => item.closedAt !== null);
  const lastClosedSource = closedAttempts[0] ?? null;

  return {
    current: currentSource
      ? {
          id: currentSource.id,
          status: currentSource.status,
          appliedAt: currentSource.appliedAt?.toISOString() ?? null,
          followUpAt: currentSource.followUpAt?.toISOString() ?? null,
          nextActionTitle: currentSource.nextActionTitle,
          resumeVersionTitle: currentSource.resumeVersion?.title ?? null,
          revisionNumber: currentSource.resumeVersionRevision?.revisionNumber ?? null,
          upcomingEventAt: currentSource.events[0]?.eventAt.toISOString() ?? null,
          upcomingEventTitle: currentSource.events[0]?.title ?? null,
        }
      : null,
    lastClosed:
      !currentSource && lastClosedSource
        ? {
            id: lastClosedSource.id,
            status: lastClosedSource.status,
            closedAt: lastClosedSource.closedAt?.toISOString() ?? null,
          }
        : null,
    totalAttempts: applications.length,
  };
}
