import type { Prisma } from "@/generated/prisma/client";

import type { EligibilityCheck, JobGap, OpportunityWarning } from "../types";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGaps(value: unknown): JobGap[] {
  return Array.isArray(value) ? (value as JobGap[]) : [];
}

export function parseEligibilityChecks(value: unknown): EligibilityCheck[] {
  return Array.isArray(value) ? (value as EligibilityCheck[]) : [];
}

export function parseWarnings(value: unknown): OpportunityWarning[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      code: typeof item.code === "string" ? item.code : "warning",
      message: typeof item.message === "string" ? item.message : "",
    }))
    .filter((item) => item.message.length > 0)
    .slice(0, 12);
}
