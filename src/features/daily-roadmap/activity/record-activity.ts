import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";

import type { RecordMeaningfulActivityInput } from "../types";
import { getOrCreateDailyRoadmapPreference } from "../preferences/preference-service";
import { getCareerLocalDate } from "../lib/timezone";
import { rebuildCareerActivityDay } from "./rebuild-day";

export async function recordMeaningfulCareerActivity(input: RecordMeaningfulActivityInput) {
  const preferences = await getOrCreateDailyRoadmapPreference(input.userId);
  const timezone = input.timezone ? input.timezone : preferences.timezone;
  const occurredAt = input.occurredAt ?? new Date();
  const localDate = getCareerLocalDate(occurredAt, timezone);

  try {
    const record = await prisma.careerActivityRecord.create({
      data: {
        userId: input.userId,
        localDate,
        timezone,
        activityType: input.activityType,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId ?? null,
        meaningful: true,
        minutes: input.minutes ?? null,
        occurredAt,
        fingerprint: input.fingerprint,
      },
    });

    await rebuildCareerActivityDay(input.userId, localDate, timezone);
    return { record, created: true as const, duplicate: false as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.careerActivityRecord.findFirst({
        where: { userId: input.userId, fingerprint: input.fingerprint },
      });
      if (existing) {
        await rebuildCareerActivityDay(input.userId, existing.localDate, existing.timezone);
        return { record: existing, created: false as const, duplicate: true as const };
      }
    }
    throw error;
  }
}

export async function tryRecordMeaningfulCareerActivity(
  input: RecordMeaningfulActivityInput,
): Promise<void> {
  try {
    await recordMeaningfulCareerActivity(input);
  } catch {
    // Domain success must never roll back because activity logging failed.
  }
}
