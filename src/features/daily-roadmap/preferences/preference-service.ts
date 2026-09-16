import { prisma } from "@/server/db/prisma";

import { DailyRoadmapAccessError } from "../errors";
import { parseActiveWeekdays, toPrismaJson } from "../lib/json";
import { validateIanaTimezone } from "../lib/timezone";
import type { CareerWeekday, DailyRoadmapPreferenceView } from "../types";
import {
  DAILY_MINUTES_MAX,
  DAILY_MINUTES_MIN,
  DEFAULT_ACTIVE_WEEKDAYS,
  DEFAULT_DAILY_MINUTES_TARGET,
  DEFAULT_MAX_CORE_ACTIONS,
  DEFAULT_TIMEZONE,
  MAX_CORE_ACTIONS_MAX,
  MAX_CORE_ACTIONS_MIN,
} from "../types";

function toView(
  row: {
    timezone: string;
    dailyMinutesTarget: number;
    maxCoreActions: number;
    activeWeekdaysJson: unknown;
    includeLinkedIn: boolean;
    includeSkillDevelopment: boolean;
  },
  timezoneSource: "user" | "default",
): DailyRoadmapPreferenceView {
  const weekdays = parseActiveWeekdays(row.activeWeekdaysJson);
  return {
    timezone: row.timezone,
    dailyMinutesTarget: row.dailyMinutesTarget,
    maxCoreActions: row.maxCoreActions,
    activeWeekdays: weekdays.length > 0 ? weekdays : [...DEFAULT_ACTIVE_WEEKDAYS],
    includeLinkedIn: row.includeLinkedIn,
    includeSkillDevelopment: row.includeSkillDevelopment,
    timezoneSource,
  };
}

export async function getOrCreateDailyRoadmapPreference(
  userId: string,
): Promise<DailyRoadmapPreferenceView> {
  const existing = await prisma.dailyRoadmapPreference.findUnique({ where: { userId } });
  if (existing) return toView(existing, existing.timezone === DEFAULT_TIMEZONE ? "default" : "user");

  const created = await prisma.dailyRoadmapPreference.create({
    data: {
      userId,
      timezone: DEFAULT_TIMEZONE,
      dailyMinutesTarget: DEFAULT_DAILY_MINUTES_TARGET,
      maxCoreActions: DEFAULT_MAX_CORE_ACTIONS,
      activeWeekdaysJson: toPrismaJson([...DEFAULT_ACTIVE_WEEKDAYS]),
      includeLinkedIn: true,
      includeSkillDevelopment: true,
    },
  });

  return toView(created, "default");
}

export type UpdateDailyRoadmapPreferenceInput = {
  timezone?: unknown;
  dailyMinutesTarget?: unknown;
  maxCoreActions?: unknown;
  activeWeekdays?: unknown;
  includeLinkedIn?: unknown;
  includeSkillDevelopment?: unknown;
};

function parseMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Daily minutes must be a whole number.");
  }
  if (value < DAILY_MINUTES_MIN || value > DAILY_MINUTES_MAX) {
    throw new DailyRoadmapAccessError(
      "INVALID_INPUT",
      `Daily minutes must be between ${DAILY_MINUTES_MIN} and ${DAILY_MINUTES_MAX}.`,
    );
  }
  return value;
}

function parseMaxCore(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Maximum core actions must be a whole number.");
  }
  if (value < MAX_CORE_ACTIONS_MIN || value > MAX_CORE_ACTIONS_MAX) {
    throw new DailyRoadmapAccessError(
      "INVALID_INPUT",
      `Maximum core actions must be between ${MAX_CORE_ACTIONS_MIN} and ${MAX_CORE_ACTIONS_MAX}.`,
    );
  }
  return value;
}

function parseWeekdays(value: unknown): CareerWeekday[] {
  const weekdays = parseActiveWeekdays(value);
  if (weekdays.length === 0) {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Select at least one active weekday.");
  }
  return weekdays;
}

export async function updateDailyRoadmapPreference(
  userId: string,
  input: UpdateDailyRoadmapPreferenceInput,
): Promise<DailyRoadmapPreferenceView> {
  await getOrCreateDailyRoadmapPreference(userId);

  const data: {
    timezone?: string;
    dailyMinutesTarget?: number;
    maxCoreActions?: number;
    activeWeekdaysJson?: ReturnType<typeof toPrismaJson>;
    includeLinkedIn?: boolean;
    includeSkillDevelopment?: boolean;
  } = {};

  if (input.timezone !== undefined) data.timezone = validateIanaTimezone(input.timezone);
  if (input.dailyMinutesTarget !== undefined) data.dailyMinutesTarget = parseMinutes(input.dailyMinutesTarget);
  if (input.maxCoreActions !== undefined) data.maxCoreActions = parseMaxCore(input.maxCoreActions);
  if (input.activeWeekdays !== undefined) {
    data.activeWeekdaysJson = toPrismaJson(parseWeekdays(input.activeWeekdays));
  }
  if (input.includeLinkedIn !== undefined) {
    if (typeof input.includeLinkedIn !== "boolean") {
      throw new DailyRoadmapAccessError("INVALID_INPUT", "includeLinkedIn must be a boolean.");
    }
    data.includeLinkedIn = input.includeLinkedIn;
  }
  if (input.includeSkillDevelopment !== undefined) {
    if (typeof input.includeSkillDevelopment !== "boolean") {
      throw new DailyRoadmapAccessError("INVALID_INPUT", "includeSkillDevelopment must be a boolean.");
    }
    data.includeSkillDevelopment = input.includeSkillDevelopment;
  }

  const updated = await prisma.dailyRoadmapPreference.update({
    where: { userId },
    data,
  });

  return toView(updated, updated.timezone === DEFAULT_TIMEZONE ? "default" : "user");
}
