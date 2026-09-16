import type { Prisma } from "@/generated/prisma/client";

import type { CareerWeekday } from "../types";
import { CAREER_WEEKDAYS } from "../types";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parseActiveWeekdays(value: unknown): CareerWeekday[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<CareerWeekday>();
  const result: CareerWeekday[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const weekday = item.trim().toUpperCase();
    if (!(CAREER_WEEKDAYS as readonly string[]).includes(weekday)) continue;
    const typed = weekday as CareerWeekday;
    if (seen.has(typed)) continue;
    seen.add(typed);
    result.push(typed);
  }
  return result;
}

export function asContextSnapshot(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
