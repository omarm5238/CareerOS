import { prisma } from "@/server/db/prisma";

import type { CareerStreakView, CareerWeekday } from "../types";
import { getOrCreateDailyRoadmapPreference } from "../preferences/preference-service";
import {
  addLocalDays,
  compareLocalDates,
  getCareerLocalDate,
  getCareerWeekBoundaries,
  isScheduledCareerDay,
  listLocalDatesInclusive,
} from "../lib/timezone";

export function calculateCareerStreakFromDays(input: {
  qualifyingDates: string[];
  activeWeekdays: readonly CareerWeekday[];
  todayLocal: string;
}): Omit<CareerStreakView, "timezone"> & { localDate: string } {
  const qualifying = new Set(input.qualifyingDates);
  const { weekStart, weekEnd } = getCareerWeekBoundaries(input.todayLocal);
  const weekDates = listLocalDatesInclusive(weekStart, weekEnd);
  const scheduledDaysThisWeek = weekDates.filter((date) =>
    isScheduledCareerDay(date, input.activeWeekdays),
  ).length;
  const activeDaysThisWeek = weekDates.filter(
    (date) =>
      compareLocalDates(date, input.todayLocal) <= 0 &&
      isScheduledCareerDay(date, input.activeWeekdays) &&
      qualifying.has(date),
  ).length;

  let currentStreak = 0;
  let cursor = input.todayLocal;
  for (let i = 0; i < 400; i += 1) {
    if (!isScheduledCareerDay(cursor, input.activeWeekdays)) {
      cursor = addLocalDays(cursor, -1);
      continue;
    }
    if (qualifying.has(cursor)) {
      currentStreak += 1;
      cursor = addLocalDays(cursor, -1);
      continue;
    }
    if (cursor === input.todayLocal) {
      cursor = addLocalDays(cursor, -1);
      continue;
    }
    break;
  }

  let longestStreak = 0;
  let running = 0;
  const earliest = input.qualifyingDates.length
    ? [...input.qualifyingDates].sort()[0]
    : input.todayLocal;
  const history = listLocalDatesInclusive(earliest, input.todayLocal);
  for (const date of history) {
    if (!isScheduledCareerDay(date, input.activeWeekdays)) continue;
    if (qualifying.has(date)) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
    } else if (date !== input.todayLocal) {
      running = 0;
    }
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  return {
    currentStreak,
    longestStreak,
    activeDaysThisWeek,
    scheduledDaysThisWeek,
    todayQualifies: qualifying.has(input.todayLocal),
    todayIsScheduledCareerDay: isScheduledCareerDay(input.todayLocal, input.activeWeekdays),
    localDate: input.todayLocal,
  };
}

export async function calculateCareerStreak(
  userId: string,
  now: Date = new Date(),
): Promise<CareerStreakView> {
  const preferences = await getOrCreateDailyRoadmapPreference(userId);
  const todayLocal = getCareerLocalDate(now, preferences.timezone);
  const days = await prisma.careerActivityDay.findMany({
    where: { userId, qualifiesForStreak: true },
    select: { localDate: true },
  });

  const computed = calculateCareerStreakFromDays({
    qualifyingDates: days.map((day) => day.localDate),
    activeWeekdays: preferences.activeWeekdays,
    todayLocal,
  });

  return {
    ...computed,
    timezone: preferences.timezone,
  };
}
