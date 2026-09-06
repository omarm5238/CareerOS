import type { Prisma } from "@/generated/prisma/client";

import type { EligibilityCheck, JobGap, OpportunityWarning } from "@/features/jobs/opportunities/types";

import type { ApplicationPackageQaResult, RequiredUserInput } from "../types";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRequiredUserInputs(value: unknown): RequiredUserInput[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RequiredUserInput => isRecord(item) && typeof item.key === "string");
}

export function parseQaSnapshot(value: unknown): ApplicationPackageQaResult {
  if (!isRecord(value)) {
    return { status: "NOT_RUN", checks: [], repairAttempted: 0 };
  }
  return {
    status: typeof value.status === "string" ? (value.status as ApplicationPackageQaResult["status"]) : "NOT_RUN",
    checks: Array.isArray(value.checks) ? (value.checks as ApplicationPackageQaResult["checks"]) : [],
    repairAttempted: typeof value.repairAttempted === "number" ? value.repairAttempted : 0,
  };
}

export function parseGaps(value: unknown): JobGap[] {
  return Array.isArray(value) ? (value as JobGap[]) : [];
}

export function parseEligibility(value: unknown): EligibilityCheck[] {
  return Array.isArray(value) ? (value as EligibilityCheck[]) : [];
}

export function parseWarnings(value: unknown): OpportunityWarning[] {
  return Array.isArray(value) ? (value as OpportunityWarning[]) : [];
}

export function parseOpportunitySnapshot(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
