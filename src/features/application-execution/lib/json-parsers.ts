import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationProvider } from "@/generated/prisma/client";

import type {
  ApplicationFormSnapshot,
  ExecutionWarning,
  FillPlan,
  FinalSubmissionSnapshot,
  PendingAction,
  ResolvedApplicationAnswer,
} from "../types";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFormSnapshot(value: unknown): ApplicationFormSnapshot | null {
  if (!isRecord(value) || !Array.isArray(value.fields)) return null;
  const snapshot = value as ApplicationFormSnapshot;
  return {
    ...snapshot,
    actions: Array.isArray(snapshot.actions) ? snapshot.actions : [],
    fields: snapshot.fields,
  };
}

export function parseFillPlan(value: unknown): FillPlan {
  if (!isRecord(value) || !Array.isArray(value.answers)) {
    return { answers: [], uploadedDocuments: [] };
  }
  return {
    answers: value.answers as ResolvedApplicationAnswer[],
    uploadedDocuments: Array.isArray(value.uploadedDocuments)
      ? (value.uploadedDocuments as FillPlan["uploadedDocuments"])
      : [],
    lockedCoverLetterRevisionId:
      typeof value.lockedCoverLetterRevisionId === "string" ? value.lockedCoverLetterRevisionId : null,
    detectionConfidence: typeof value.detectionConfidence === "number" ? value.detectionConfidence : null,
    runtimeCapability:
      isRecord(value.runtimeCapability) && typeof value.runtimeCapability.provider === "string"
        ? (value.runtimeCapability as FillPlan["runtimeCapability"])
        : null,
  };
}

export function parsePendingActions(value: unknown): PendingAction[] {
  return Array.isArray(value) ? (value as PendingAction[]) : [];
}

export function parseWarnings(value: unknown): ExecutionWarning[] {
  return Array.isArray(value) ? (value as ExecutionWarning[]) : [];
}

export function parseFinalSnapshot(value: unknown): FinalSubmissionSnapshot | null {
  if (!isRecord(value) || typeof value.applicationPackageId !== "string") return null;
  return value as FinalSubmissionSnapshot;
}

export function parseProvider(value: string): ApplicationProvider {
  const allowed: ApplicationProvider[] = [
    "GREENHOUSE",
    "LEVER",
    "ASHBY",
    "WORKABLE",
    "SMARTRECRUITERS",
    "GENERIC",
    "UNKNOWN",
  ];
  return allowed.includes(value as ApplicationProvider) ? (value as ApplicationProvider) : "UNKNOWN";
}
