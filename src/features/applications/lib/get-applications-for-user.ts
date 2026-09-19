import { prisma } from "@/server/db/prisma";

import type { ApplicationStatus } from "@/generated/prisma/client";

import {
  ACTIVE_APPLICATION_STATUSES,
  SCHEDULED_EVENT_TYPES,
  UPCOMING_WINDOW_DAYS,
} from "../types";
import type {
  ApplicationListItem,
  ApplicationMetrics,
  ApplicationUpcomingEvent,
} from "../types";
import { parseApplicationEventMetadata, parseApplicationSnapshot } from "./json-parsers";

const UPCOMING_EVENT_SELECT = {
  id: true,
  type: true,
  title: true,
  description: true,
  eventAt: true,
  metadataJson: true,
} as const;

function upcomingWindowEnd(now: Date): Date {
  const end = new Date(now);
  end.setDate(end.getDate() + UPCOMING_WINDOW_DAYS);
  return end;
}

/**
 * Loads applications with the single upcoming scheduled event per row.
 *
 * The upcoming event is fetched via a scoped nested `take: 1` rather than a
 * per-row query so the list stays free of N+1 lookups.
 */
export async function getApplicationsForUser(userId: string): Promise<ApplicationListItem[]> {
  const now = new Date();

  const applications = await prisma.application.findMany({
    where: { userId },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      status: true,
      source: true,
      jobPostingId: true,
      appliedAt: true,
      followUpAt: true,
      lastActivityAt: true,
      closedAt: true,
      nextActionType: true,
      nextActionTitle: true,
      nextActionReason: true,
      nextActionDueAt: true,
      nextActionSource: true,
      contextSnapshotJson: true,
      resumeVersionId: true,
      resumeVersionRevisionId: true,
      createdAt: true,
      updatedAt: true,
      resumeVersion: { select: { id: true, title: true, status: true } },
      resumeVersionRevision: {
        select: { id: true, revisionNumber: true, alignmentScoreAfter: true },
      },
      events: {
        where: { type: { in: [...SCHEDULED_EVENT_TYPES] }, eventAt: { gte: now } },
        orderBy: { eventAt: "asc" },
        take: 1,
        select: UPCOMING_EVENT_SELECT,
      },
    },
  });

  return applications.map((application) => {
    const snapshot = parseApplicationSnapshot(application.contextSnapshotJson);
    const upcoming = application.events[0];

    const upcomingEvent: ApplicationUpcomingEvent | null = upcoming
      ? {
          id: upcoming.id,
          type: upcoming.type,
          title: upcoming.title,
          description: upcoming.description,
          eventAt: upcoming.eventAt.toISOString(),
          metadata: parseApplicationEventMetadata(upcoming.metadataJson),
        }
      : null;

    return {
      id: application.id,
      status: application.status,
      source: application.source,
      jobPostingId: application.jobPostingId,
      jobTitle: snapshot.job.title ?? "Untitled role",
      company: snapshot.job.company ?? "Unknown company",
      appliedAt: application.appliedAt?.toISOString() ?? null,
      followUpAt: application.followUpAt?.toISOString() ?? null,
      lastActivityAt: application.lastActivityAt.toISOString(),
      closedAt: application.closedAt?.toISOString() ?? null,
      nextAction: {
        type: application.nextActionType,
        title: application.nextActionTitle,
        reason: application.nextActionReason,
        dueAt: application.nextActionDueAt?.toISOString() ?? null,
        source: application.nextActionSource,
      },
      resume: {
        resumeVersionId: application.resumeVersionId,
        resumeVersionTitle:
          application.resumeVersion?.title ?? snapshot.resume.resumeVersionTitle,
        resumeVersionStatus: application.resumeVersion?.status ?? null,
        resumeVersionRevisionId: application.resumeVersionRevisionId,
        revisionNumber:
          application.resumeVersionRevision?.revisionNumber ?? snapshot.resume.revisionNumber,
        alignmentScoreAfter:
          application.resumeVersionRevision?.alignmentScoreAfter ??
          snapshot.resume.alignmentScoreAfter,
        recordAvailable: application.resumeVersion !== null,
      },
      upcomingEvent,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
  });
}

/** Deterministic metrics. No AI input is involved in any of these counts. */
export function computeApplicationMetrics(
  applications: ApplicationListItem[],
  now: Date = new Date(),
): ApplicationMetrics {
  const windowEnd = upcomingWindowEnd(now);
  const activeStatuses = ACTIVE_APPLICATION_STATUSES as readonly ApplicationStatus[];

  let active = 0;
  let needsAction = 0;
  let upcoming = 0;
  let offers = 0;

  for (const application of applications) {
    const isClosed = application.closedAt !== null;

    if (activeStatuses.includes(application.status)) active += 1;
    if (application.status === "OFFER") offers += 1;

    if (!isClosed && isApplicationDue(application, now)) needsAction += 1;

    if (application.upcomingEvent) {
      const eventAt = new Date(application.upcomingEvent.eventAt);
      if (eventAt >= now && eventAt <= windowEnd) upcoming += 1;
    }
  }

  return { active, needsAction, upcoming, offers };
}

/** A non-closed application is "due" when its next action or follow-up has arrived. */
export function isApplicationDue(application: ApplicationListItem, now: Date = new Date()): boolean {
  if (application.closedAt !== null) return false;

  const dueDates = [application.nextAction.dueAt, application.followUpAt];
  return dueDates.some((value) => value !== null && new Date(value) <= now);
}
