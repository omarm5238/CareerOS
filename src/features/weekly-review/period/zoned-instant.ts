import { WeeklyReviewAccessError } from "../errors";

type ZoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function readZoneParts(date: Date, timezone: string): ZoneParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    fractionalSecondDigits: 3,
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);

  const year = lookup("year");
  const month = lookup("month");
  const day = lookup("day");
  const hour = lookup("hour");
  const minute = lookup("minute");
  const second = lookup("second");
  const millisecond = lookup("fractionalSecond");
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    throw new WeeklyReviewAccessError("INVALID_INPUT", "Could not resolve a zoned timestamp.");
  }
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond: Number.isFinite(millisecond) ? millisecond : 0,
  };
}

export function zonedLocalToUtc(
  localDate: string,
  time: { hour: number; minute: number; second: number; millisecond: number },
  timezone: string,
): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, time.hour, time.minute, time.second, time.millisecond);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const actual = readZoneParts(new Date(utcMs), timezone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      actual.millisecond,
    );
    const desired = Date.UTC(year, month - 1, day, time.hour, time.minute, time.second, time.millisecond);
    const delta = desired - actualAsUtc;
    if (delta === 0) break;
    utcMs += delta;
  }
  return new Date(utcMs);
}

export function utcInLocalWeek(
  value: Date,
  weekStartLocalDate: string,
  weekEndLocalDate: string,
  timezone: string,
): boolean {
  const start = zonedLocalToUtc(weekStartLocalDate, { hour: 0, minute: 0, second: 0, millisecond: 0 }, timezone);
  const end = zonedLocalToUtc(
    weekEndLocalDate,
    { hour: 23, minute: 59, second: 59, millisecond: 999 },
    timezone,
  );
  return value.getTime() >= start.getTime() && value.getTime() <= end.getTime();
}
