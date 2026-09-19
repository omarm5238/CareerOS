import { prisma } from "@/server/db/prisma";

import { DailyRoadmapAccessError } from "../errors";
import { activityFingerprint } from "../lib/fingerprint";
import { asContextSnapshot, toPrismaJson } from "../lib/json";
import { addLocalDays, assertLocalDate, compareLocalDates, getCareerLocalDate, lastScheduledDayThisWeek } from "../lib/timezone";
import { bucketMinutes, toActionView } from "../lib/views";
import { activityTypeForRoadmapAction, isMeaningfulActionType } from "../activity/classifier";
import { recordMeaningfulCareerActivity } from "../activity/record-activity";
import { rebuildCareerActivityDay } from "../activity/rebuild-day";
import { getOrCreateDailyRoadmapPreference } from "../preferences/preference-service";
import { getOwnedAction } from "./generate-today";
import type { DailyRoadmapActionView, EstimatedMinuteBucket, SkipReason } from "../types";
import { ESTIMATED_MINUTE_BUCKETS, SKIP_REASONS } from "../types";

async function touchActivityDay(userId: string, localDate: string, timezone: string) {
  await rebuildCareerActivityDay(userId, localDate, timezone);
}

export async function completeDailyRoadmapAction(
  userId: string,
  actionId: string,
  body: Record<string, unknown> = {},
): Promise<DailyRoadmapActionView> {
  void body.completionSource;
  void body.userId;
  void body.isMeaningful;
  void body.priorityScore;

  const action = await getOwnedAction(userId, actionId);
  if (action.status === "COMPLETED") return toActionView(action);

  const now = new Date();
  const updated = await prisma.dailyRoadmapAction.update({
    where: { id: action.id },
    data: {
      status: "COMPLETED",
      completedAt: now,
      completionSource: "USER_CONFIRMED",
    },
  });

  if (updated.isMeaningful || isMeaningfulActionType(updated.type)) {
    const activityType = activityTypeForRoadmapAction(updated.type);
    if (activityType) {
      const roadmap = await prisma.dailyRoadmap.findUniqueOrThrow({ where: { id: updated.dailyRoadmapId } });
      await recordMeaningfulCareerActivity({
        userId,
        activityType,
        fingerprint: activityFingerprint(["ROADMAP_ACTION_COMPLETED", updated.id]),
        sourceEntityType: updated.sourceEntityType,
        sourceEntityId: updated.sourceEntityId,
        minutes: updated.estimatedMinutes,
        occurredAt: now,
        timezone: roadmap.timezone,
      });
    }
    const { ingestCareerMemorySafe } = await import("@/features/career-memory/ingestion/refresh");
    await ingestCareerMemorySafe(userId, "EVENT_DRIVEN");
  } else {
    const roadmap = await prisma.dailyRoadmap.findUniqueOrThrow({ where: { id: updated.dailyRoadmapId } });
    await touchActivityDay(userId, roadmap.localDate, roadmap.timezone);
  }

  return toActionView(updated);
}

export async function deferDailyRoadmapAction(
  userId: string,
  actionId: string,
  body: Record<string, unknown>,
): Promise<DailyRoadmapActionView> {
  const action = await getOwnedAction(userId, actionId);
  const preferences = await getOrCreateDailyRoadmapPreference(userId);
  const today = getCareerLocalDate(new Date(), preferences.timezone);

  let deferredUntil: string | null = null;
  const preset = typeof body.preset === "string" ? body.preset.toUpperCase() : null;
  if (preset === "TOMORROW") {
    deferredUntil = addLocalDays(today, 1);
  } else if (preset === "LATER_THIS_WEEK") {
    deferredUntil = lastScheduledDayThisWeek(today, preferences.activeWeekdays);
    if (!deferredUntil || compareLocalDates(deferredUntil, today) <= 0) {
      throw new DailyRoadmapAccessError("INVALID_INPUT", "There is no remaining scheduled day later this week.");
    }
  } else if (typeof body.deferredUntil === "string") {
    deferredUntil = assertLocalDate(body.deferredUntil);
  } else {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Choose Tomorrow, Later This Week, or a date.");
  }

  if (compareLocalDates(deferredUntil, today) <= 0) {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Deferral date must be after today.");
  }

  const updated = await prisma.dailyRoadmapAction.update({
    where: { id: action.id },
    data: {
      status: "DEFERRED",
      deferredUntil,
      contextSnapshotJson: toPrismaJson({
        ...asContextSnapshot(action.contextSnapshotJson),
        deferPreset: preset,
      }),
    },
  });

  return toActionView(updated);
}

export async function skipDailyRoadmapAction(
  userId: string,
  actionId: string,
  body: Record<string, unknown> = {},
): Promise<DailyRoadmapActionView> {
  const action = await getOwnedAction(userId, actionId);
  const reasonRaw = typeof body.reason === "string" ? body.reason.toUpperCase() : "OTHER";
  const reason = (SKIP_REASONS as readonly string[]).includes(reasonRaw)
    ? (reasonRaw as SkipReason)
    : "OTHER";

  const updated = await prisma.dailyRoadmapAction.update({
    where: { id: action.id },
    data: {
      status: "SKIPPED",
      contextSnapshotJson: toPrismaJson({
        ...asContextSnapshot(action.contextSnapshotJson),
        skipReason: reason,
      }),
    },
  });

  return toActionView(updated);
}

function parseOptionalEstimatedMinutes(value: unknown): EstimatedMinuteBucket {
  if (value === undefined || value === null || value === "") return 15;

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new DailyRoadmapAccessError(
      "INVALID_INPUT",
      "Estimated time must be 5, 10, 15, 30, 45, 60, or 90 minutes.",
    );
  }

  const rounded = Math.round(numeric);
  if ((ESTIMATED_MINUTE_BUCKETS as readonly number[]).includes(rounded)) {
    return rounded as EstimatedMinuteBucket;
  }
  return bucketMinutes(numeric);
}

export async function createCustomCareerAction(
  userId: string,
  body: Record<string, unknown>,
): Promise<DailyRoadmapActionView> {
  void body.priorityScore;
  void body.priorityBand;
  void body.isMeaningful;
  void body.completionSource;
  void body.origin;
  void body.sourceEntityType;
  void body.sourceEntityId;
  void body.userId;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Provide a career action title.");
  }

  const minutes = parseOptionalEstimatedMinutes(body.estimatedMinutes);

  const preferences = await getOrCreateDailyRoadmapPreference(userId);
  const localDate = getCareerLocalDate(new Date(), preferences.timezone);
  const roadmap = await prisma.dailyRoadmap.findUnique({
    where: { userId_localDate: { userId, localDate } },
  });
  if (!roadmap) {
    throw new DailyRoadmapAccessError("CONFLICT", "Generate today's roadmap before adding a custom action.");
  }

  const fingerprint = `CUSTOM_CAREER_ACTION:NONE:${title.toLowerCase()}:${Date.now()}`;
  const created = await prisma.dailyRoadmapAction.create({
    data: {
      userId,
      dailyRoadmapId: roadmap.id,
      type: "CUSTOM_CAREER_ACTION",
      origin: "USER_CREATED",
      sourceEntityType: "NONE",
      sourceEntityId: null,
      title,
      summary: null,
      whyNow: "You added this career action to today's plan.",
      priorityScore: 55,
      priorityBand: "MEDIUM",
      estimatedMinutes: minutes,
      status: "PLANNED",
      isMeaningful: true,
      isActionable: true,
      sortOrder: 50,
      deepLink: null,
      fingerprint,
      contextSnapshotJson: toPrismaJson({ optionalLater: false, userCreated: true }),
    },
  });

  await prisma.dailyRoadmap.update({
    where: { id: roadmap.id },
    data: { plannedMinutes: { increment: minutes } },
  });

  return toActionView(created);
}
