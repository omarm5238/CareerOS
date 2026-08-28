import { prisma } from "@/server/db/prisma";

import {
  ApplicationAccessError,
  assertApplicationOwnedByUser,
} from "./application-permissions";
import { recordApplicationEvent } from "./create-application-event";

export type FollowUpAction = "schedule" | "clear" | "sent";

export type ScheduleApplicationFollowUpInput = {
  userId: string;
  applicationId: string;
  action: FollowUpAction;
  followUpAt?: string | null;
};

export type ScheduleApplicationFollowUpResult = {
  applicationId: string;
  followUpAt: string | null;
  unchanged: boolean;
};

/**
 * Follow-up lives in a real relational column so the Daily Roadmap can query it
 * later without unpacking JSON.
 */
export async function scheduleApplicationFollowUp(
  input: ScheduleApplicationFollowUpInput,
): Promise<ScheduleApplicationFollowUpResult> {
  const application = await assertApplicationOwnedByUser(input.userId, input.applicationId);
  const now = new Date();

  if (input.action === "schedule") {
    if (!input.followUpAt) {
      throw new ApplicationAccessError("INVALID_INPUT", "Choose a follow-up date.");
    }

    const followUpAt = new Date(input.followUpAt);
    if (Number.isNaN(followUpAt.getTime())) {
      throw new ApplicationAccessError("INVALID_INPUT", "Provide a valid follow-up date.");
    }

    // Duplicate protection for UI retries scheduling the identical moment.
    if (application.followUpAt && application.followUpAt.getTime() === followUpAt.getTime()) {
      return {
        applicationId: application.id,
        followUpAt: followUpAt.toISOString(),
        unchanged: true,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: { followUpAt, lastActivityAt: now },
      });

      await recordApplicationEvent(tx, {
        applicationId: application.id,
        userId: input.userId,
        type: "FOLLOW_UP_SCHEDULED",
        source: "USER",
        title: "Follow-up scheduled",
        eventAt: followUpAt,
      });
    });

    return { applicationId: application.id, followUpAt: followUpAt.toISOString(), unchanged: false };
  }

  if (!application.followUpAt && input.action === "sent") {
    throw new ApplicationAccessError("INVALID_INPUT", "There is no scheduled follow-up to send.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: { followUpAt: null, lastActivityAt: now },
    });

    await recordApplicationEvent(tx, {
      applicationId: application.id,
      userId: input.userId,
      type: input.action === "sent" ? "FOLLOW_UP_SENT" : "FOLLOW_UP_CLEARED",
      source: "USER",
      title: input.action === "sent" ? "Follow-up sent" : "Follow-up cleared",
      eventAt: now,
    });
  });

  return { applicationId: application.id, followUpAt: null, unchanged: false };
}
