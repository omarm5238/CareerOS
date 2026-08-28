import { prisma } from "@/server/db/prisma";

import { SCHEDULED_EVENT_TYPES } from "../types";
import type {
  ApplicationDetail,
  ApplicationInsightDetail,
  ApplicationUpcomingEvent,
} from "../types";
import type { ApplicationInsightType } from "@/generated/prisma/client";
import {
  parseApplicationDocuments,
  parseApplicationEventMetadata,
  parseApplicationSnapshot,
  parseInsightWarnings,
} from "./json-parsers";

const TIMELINE_LIMIT = 100;

export async function getApplicationDetailForUser(
  userId: string,
  applicationId: string,
): Promise<ApplicationDetail | null> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: {
      id: true,
      status: true,
      source: true,
      jobPostingId: true,
      appliedAt: true,
      followUpAt: true,
      lastActivityAt: true,
      rejectedAt: true,
      closedAt: true,
      nextActionType: true,
      nextActionTitle: true,
      nextActionReason: true,
      nextActionDueAt: true,
      nextActionSource: true,
      notes: true,
      companyNotes: true,
      salaryNotes: true,
      documentsNeededJson: true,
      confirmedRejectionReason: true,
      confirmedRejectionSource: true,
      contextSnapshotJson: true,
      resumeVersionId: true,
      resumeVersionRevisionId: true,
      createdAt: true,
      updatedAt: true,
      jobPosting: { select: { id: true, title: true, company: true, location: true, jobUrl: true } },
      resumeVersion: { select: { id: true, title: true, status: true } },
      resumeVersionRevision: {
        select: { id: true, revisionNumber: true, alignmentScoreAfter: true },
      },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          role: true,
          company: true,
          email: true,
          phone: true,
          linkedinUrl: true,
          notes: true,
          isPrimary: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      events: {
        orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }],
        take: TIMELINE_LIMIT,
        select: {
          id: true,
          type: true,
          source: true,
          title: true,
          description: true,
          fromStatus: true,
          toStatus: true,
          eventAt: true,
          createdAt: true,
          metadataJson: true,
        },
      },
    },
  });

  if (!application) return null;

  const snapshot = parseApplicationSnapshot(application.contextSnapshotJson);
  const now = new Date();

  const upcomingSource = application.events
    .filter(
      (event) =>
        (SCHEDULED_EVENT_TYPES as readonly string[]).includes(event.type) &&
        event.eventAt >= now,
    )
    .sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime())[0];

  const upcomingEvent: ApplicationUpcomingEvent | null = upcomingSource
    ? {
        id: upcomingSource.id,
        type: upcomingSource.type,
        title: upcomingSource.title,
        description: upcomingSource.description,
        eventAt: upcomingSource.eventAt.toISOString(),
        metadata: parseApplicationEventMetadata(upcomingSource.metadataJson),
      }
    : null;

  return {
    id: application.id,
    status: application.status,
    source: application.source,
    jobPostingId: application.jobPostingId,
    // Snapshot values are the fallback so a deleted job still renders.
    jobTitle: application.jobPosting?.title ?? snapshot.job.title ?? "Untitled role",
    company: application.jobPosting?.company ?? snapshot.job.company ?? "Unknown company",
    location: application.jobPosting?.location ?? snapshot.job.location,
    jobUrl: application.jobPosting?.jobUrl ?? snapshot.job.jobUrl,
    jobRecordAvailable: application.jobPosting !== null,
    appliedAt: application.appliedAt?.toISOString() ?? null,
    followUpAt: application.followUpAt?.toISOString() ?? null,
    lastActivityAt: application.lastActivityAt.toISOString(),
    rejectedAt: application.rejectedAt?.toISOString() ?? null,
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
      resumeVersionTitle: application.resumeVersion?.title ?? snapshot.resume.resumeVersionTitle,
      resumeVersionStatus: application.resumeVersion?.status ?? null,
      resumeVersionRevisionId: application.resumeVersionRevisionId,
      revisionNumber:
        application.resumeVersionRevision?.revisionNumber ?? snapshot.resume.revisionNumber,
      alignmentScoreAfter:
        application.resumeVersionRevision?.alignmentScoreAfter ??
        snapshot.resume.alignmentScoreAfter,
      recordAvailable: application.resumeVersion !== null,
    },
    notes: application.notes,
    companyNotes: application.companyNotes,
    salaryNotes: application.salaryNotes,
    documents: parseApplicationDocuments(application.documentsNeededJson),
    confirmedRejectionReason: application.confirmedRejectionReason,
    confirmedRejectionSource: application.confirmedRejectionSource,
    snapshot,
    timeline: application.events.map((event) => ({
      id: event.id,
      type: event.type,
      source: event.source,
      title: event.title,
      description: event.description,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      eventAt: event.eventAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
      metadata: parseApplicationEventMetadata(event.metadataJson),
    })),
    contacts: application.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      company: contact.company,
      email: contact.email,
      phone: contact.phone,
      linkedinUrl: contact.linkedinUrl,
      notes: contact.notes,
      isPrimary: contact.isPrimary,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    })),
    upcomingEvent,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

/** Latest stored insight of a type. History rows are preserved, never overwritten. */
export async function getLatestApplicationInsight<TContent>(
  userId: string,
  applicationId: string,
  type: ApplicationInsightType,
): Promise<ApplicationInsightDetail<TContent> | null> {
  const insight = await prisma.applicationInsight.findFirst({
    where: { userId, applicationId, type },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      source: true,
      contentJson: true,
      model: true,
      aiSource: true,
      warningsJson: true,
      createdAt: true,
    },
  });

  if (!insight) return null;

  return {
    id: insight.id,
    type: insight.type,
    source: insight.source,
    content: insight.contentJson as TContent,
    model: insight.model,
    aiSource: insight.aiSource,
    warnings: parseInsightWarnings(insight.warningsJson),
    createdAt: insight.createdAt.toISOString(),
  };
}
