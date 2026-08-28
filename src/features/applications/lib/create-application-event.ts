import { prisma } from "@/server/db/prisma";

import type {
  ApplicationEventSource,
  ApplicationEventType,
  ApplicationStatus,
  Prisma,
} from "@/generated/prisma/client";

import type { ApplicationEventMetadata } from "../types";
import {
  ApplicationAccessError,
  assertApplicationOwnedByUser,
  isManualApplicationEventType,
} from "./application-permissions";
import { toPrismaJson } from "./json-parsers";

export type ApplicationEventDraft = {
  applicationId: string;
  userId: string;
  type: ApplicationEventType;
  source?: ApplicationEventSource;
  title: string;
  description?: string | null;
  fromStatus?: ApplicationStatus | null;
  toStatus?: ApplicationStatus | null;
  eventAt?: Date;
  metadata?: ApplicationEventMetadata;
};

/**
 * Writes one timeline event. Callers inside a status transaction pass their `tx`
 * so the event and the state change commit together.
 */
export function recordApplicationEvent(
  tx: Prisma.TransactionClient,
  draft: ApplicationEventDraft,
) {
  return tx.applicationEvent.create({
    data: {
      applicationId: draft.applicationId,
      userId: draft.userId,
      type: draft.type,
      source: draft.source ?? "SYSTEM",
      title: draft.title,
      description: draft.description ?? null,
      fromStatus: draft.fromStatus ?? null,
      toStatus: draft.toStatus ?? null,
      eventAt: draft.eventAt ?? new Date(),
      metadataJson: toPrismaJson(draft.metadata ?? {}),
    },
  });
}

export type AddManualApplicationEventInput = {
  userId: string;
  applicationId: string;
  type: string;
  title?: string | null;
  description?: string | null;
  eventAt?: string | null;
  metadata?: ApplicationEventMetadata;
};

const MANUAL_EVENT_TITLES: Partial<Record<ApplicationEventType, string>> = {
  SCREENING_SCHEDULED: "Screening scheduled",
  SCREENING_COMPLETED: "Screening completed",
  ASSESSMENT_RECEIVED: "Assessment received",
  ASSESSMENT_SCHEDULED: "Assessment scheduled",
  ASSESSMENT_COMPLETED: "Assessment completed",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  INTERVIEW_COMPLETED: "Interview completed",
  OFFER_RECEIVED: "Offer received",
  FOLLOW_UP_SENT: "Follow-up sent",
  NOTE_ADDED: "Note added",
  OTHER: "Application update",
};

/**
 * User-recorded timeline entry. This endpoint deliberately cannot carry
 * fromStatus/toStatus — only the transition service may move an application.
 */
export async function addManualApplicationEvent(input: AddManualApplicationEventInput) {
  await assertApplicationOwnedByUser(input.userId, input.applicationId);

  if (!isManualApplicationEventType(input.type)) {
    throw new ApplicationAccessError("INVALID_INPUT", "That event type cannot be added manually.");
  }

  const eventType = input.type;

  const eventAt = input.eventAt ? new Date(input.eventAt) : new Date();
  if (Number.isNaN(eventAt.getTime())) {
    throw new ApplicationAccessError("INVALID_INPUT", "Provide a valid event date.");
  }

  const title = input.title?.trim() || MANUAL_EVENT_TITLES[eventType] || "Application update";
  const description = input.description?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const event = await recordApplicationEvent(tx, {
      applicationId: input.applicationId,
      userId: input.userId,
      type: eventType,
      source: "USER",
      title: title.slice(0, 160),
      description: description ? description.slice(0, 1_200) : null,
      eventAt,
      metadata: input.metadata,
    });

    await tx.application.update({
      where: { id: input.applicationId },
      data: { lastActivityAt: new Date() },
    });

    return event;
  });
}
