import { DailyRoadmapAccessError } from "../errors";
import type { CareerWeekday } from "../types";
import { CAREER_WEEKDAYS, DEFAULT_ACTIVE_WEEKDAYS } from "../types";

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IANA_NAME_RE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/;

const JS_DAY_TO_WEEKDAY: CareerWeekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

export function validateIanaTimezone(value: unknown): string {
  if (typeof value !== "string") {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Timezone must be an IANA identifier.");
  }

  const timezone = value.trim();
  if (!timezone) {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Timezone is required.");
  }

  if (/^GMT[+-]/i.test(timezone) || timezone.toLowerCase().includes("time") || timezone.includes(" ")) {
    throw new DailyRoadmapAccessError(
      "INVALID_INPUT",
      "Use an IANA timezone such as Europe/Istanbul or UTC.",
    );
  }

  if (timezone !== "UTC" && !IANA_NAME_RE.test(timezone)) {
    throw new DailyRoadmapAccessError(
      "INVALID_INPUT",
      "Use an IANA timezone such as Europe/Istanbul or UTC.",
    );
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new DailyRoadmapAccessError(
      "INVALID_INPUT",
      "Use an IANA timezone such as Europe/Istanbul or UTC.",
    );
  }

  return timezone;
}

export function isValidIanaTimezone(value: unknown): value is string {
  try {
    validateIanaTimezone(value);
    return true;
  } catch {
    return false;
  }
}

export function getCareerLocalDate(now: Date, timezone: string): string {
  const safeTimezone = validateIanaTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Could not resolve a local career date.");
  }
  return `${year}-${month}-${day}`;
}

export function assertLocalDate(value: unknown): string {
  if (typeof value !== "string" || !LOCAL_DATE_RE.test(value.trim())) {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Provide a valid local date (YYYY-MM-DD).");
  }
  const localDate = value.trim();
  const [year, month, day] = localDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new DailyRoadmapAccessError("INVALID_INPUT", "Provide a valid local date (YYYY-MM-DD).");
  }
  return localDate;
}

export function addLocalDays(localDate: string, days: number): string {
  const valid = assertLocalDate(localDate);
  const [year, month, day] = valid.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function compareLocalDates(a: string, b: string): number {
  return assertLocalDate(a).localeCompare(assertLocalDate(b));
}

export function weekdayFromLocalDate(localDate: string): CareerWeekday {
  const valid = assertLocalDate(localDate);
  const [year, month, day] = valid.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return JS_DAY_TO_WEEKDAY[utc.getUTCDay()] ?? "MON";
}

export function isScheduledCareerDay(
  localDate: string,
  activeWeekdays: readonly CareerWeekday[] = DEFAULT_ACTIVE_WEEKDAYS,
): boolean {
  const weekday = weekdayFromLocalDate(localDate);
  return activeWeekdays.includes(weekday);
}

export function getCareerWeekBoundaries(localDate: string): { weekStart: string; weekEnd: string } {
  const weekday = weekdayFromLocalDate(localDate);
  const index = CAREER_WEEKDAYS.indexOf(weekday);
  const mondayOffset = weekday === "SUN" ? -6 : 1 - (index >= 0 ? index : 1);
  const weekStart = addLocalDays(localDate, mondayOffset);
  return { weekStart, weekEnd: addLocalDays(weekStart, 6) };
}

export function listLocalDatesInclusive(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = assertLocalDate(start);
  const last = assertLocalDate(end);
  while (compareLocalDates(cursor, last) <= 0) {
    dates.push(cursor);
    cursor = addLocalDays(cursor, 1);
    if (dates.length > 800) break;
  }
  return dates;
}

export function nextScheduledCareerDay(
  localDate: string,
  activeWeekdays: readonly CareerWeekday[],
  options?: { afterDays?: number },
): string | null {
  const startOffset = options?.afterDays ?? 1;
  for (let offset = startOffset; offset <= startOffset + 14; offset += 1) {
    const candidate = addLocalDays(localDate, offset);
    if (isScheduledCareerDay(candidate, activeWeekdays)) return candidate;
  }
  return null;
}

export function lastScheduledDayThisWeek(
  localDate: string,
  activeWeekdays: readonly CareerWeekday[],
): string | null {
  const { weekEnd } = getCareerWeekBoundaries(localDate);
  const dates = listLocalDatesInclusive(addLocalDays(localDate, 1), weekEnd);
  const scheduled = dates.filter((date) => isScheduledCareerDay(date, activeWeekdays));
  return scheduled.at(-1) ?? null;
}
