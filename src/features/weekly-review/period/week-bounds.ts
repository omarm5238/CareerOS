import {
  addLocalDays,
  assertLocalDate,
  compareLocalDates,
  getCareerLocalDate,
  listLocalDatesInclusive,
  validateIanaTimezone,
  weekdayFromLocalDate,
} from "@/features/daily-roadmap/lib/timezone";

import { WeeklyReviewAccessError } from "../errors";
import { zonedLocalToUtc } from "./zoned-instant";
import type { CareerWeekday } from "@/features/daily-roadmap/types";

const MONDAY_OFFSET: Record<CareerWeekday, number> = {
  MON: 0,
  TUE: -1,
  WED: -2,
  THU: -3,
  FRI: -4,
  SAT: -5,
  SUN: -6,
};

function weekBoundaries(localDate: string): { weekStart: string; weekEnd: string } {
  const weekday = weekdayFromLocalDate(localDate);
  const weekStart = addLocalDays(localDate, MONDAY_OFFSET[weekday]);
  return { weekStart, weekEnd: addLocalDays(weekStart, 6) };
}

export const WEEKLY_HISTORY_BOUND = 12;

export type CareerWeekPeriod = {
  weekStartLocalDate: string;
  weekEndLocalDate: string;
  timezone: string;
  startUtc: Date;
  endUtc: Date;
  localDates: string[];
  isComplete: boolean;
  isCurrent: boolean;
};

export function getWeekStartLocalDate(now: Date, timezone: string): string {
  return getCareerWeekBounds(now, validateIanaTimezone(timezone)).weekStartLocalDate;
}

export function getWeekEndLocalDate(now: Date, timezone: string): string {
  return getCareerWeekBounds(now, validateIanaTimezone(timezone)).weekEndLocalDate;
}

export function getPreviousWeekStartLocalDate(weekStartLocalDate: string): string {
  return addLocalDays(assertLocalDate(weekStartLocalDate), -7);
}

export function getNextWeekStartLocalDate(weekStartLocalDate: string): string {
  return addLocalDays(assertLocalDate(weekStartLocalDate), 7);
}

export function isWeekComplete(weekEndLocalDate: string, now: Date, timezone: string): boolean {
  const today = getCareerLocalDate(now, validateIanaTimezone(timezone));
  return compareLocalDates(today, assertLocalDate(weekEndLocalDate)) > 0;
}

export function getCareerWeekBounds(
  localDateOrNow: string | Date,
  timezone: string,
): CareerWeekPeriod {
  const safeTimezone = validateIanaTimezone(timezone);
  const localDate =
    typeof localDateOrNow === "string"
      ? assertLocalDate(localDateOrNow)
      : getCareerLocalDate(localDateOrNow, safeTimezone);
  const { weekStart, weekEnd } = weekBoundaries(localDate);
  const now = typeof localDateOrNow === "string" ? new Date() : localDateOrNow;
  const today = getCareerLocalDate(now, safeTimezone);
  return {
    weekStartLocalDate: weekStart,
    weekEndLocalDate: weekEnd,
    timezone: safeTimezone,
    startUtc: zonedLocalToUtc(weekStart, { hour: 0, minute: 0, second: 0, millisecond: 0 }, safeTimezone),
    endUtc: zonedLocalToUtc(
      weekEnd,
      { hour: 23, minute: 59, second: 59, millisecond: 999 },
      safeTimezone,
    ),
    localDates: listLocalDatesInclusive(weekStart, weekEnd),
    isComplete: isWeekComplete(weekEnd, now, safeTimezone),
    isCurrent: today >= weekStart && today <= weekEnd,
  };
}

export function resolveRequestedWeekStart(
  requestedWeekStart: unknown,
  now: Date,
  timezone: string,
): CareerWeekPeriod {
  const current = getCareerWeekBounds(now, timezone);
  if (requestedWeekStart === undefined || requestedWeekStart === null || requestedWeekStart === "") {
    return current;
  }
  if (typeof requestedWeekStart !== "string") {
    throw new WeeklyReviewAccessError("INVALID_INPUT", "Provide a valid week start date (YYYY-MM-DD).");
  }
  const requested = getCareerWeekBounds(requestedWeekStart, timezone);
  return assertRecentWeek(requested, current);
}

export function assertRecentWeek(target: CareerWeekPeriod, current: CareerWeekPeriod): CareerWeekPeriod {
  const earliest = addLocalDays(current.weekStartLocalDate, -(WEEKLY_HISTORY_BOUND - 1) * 7);
  if (compareLocalDates(target.weekStartLocalDate, earliest) < 0) {
    throw new WeeklyReviewAccessError(
      "INVALID_INPUT",
      "Weekly reviews can only be generated for the current week and the previous 11 weeks.",
    );
  }
  if (compareLocalDates(target.weekStartLocalDate, current.weekStartLocalDate) > 0) {
    throw new WeeklyReviewAccessError("INVALID_INPUT", "Future weeks cannot be generated.");
  }
  return target;
}

export function formatWeekLabel(weekStartLocalDate: string, weekEndLocalDate: string): string {
  const start = new Date(`${weekStartLocalDate}T00:00:00.000Z`);
  const end = new Date(`${weekEndLocalDate}T00:00:00.000Z`);
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${startLabel}–${endLabel}`;
}
