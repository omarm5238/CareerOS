import type { careerMemory, careerMemoryEvidence } from "@/generated/prisma/client";

import { asRecord } from "../lib/json";
import type { CareerMemoryView } from "../types";

export function confidenceLabel(confidence: CareerMemoryView["confidence"]): string {
  if (confidence === "HIGH") return "Confirmed / Well supported";
  if (confidence === "MEDIUM") return "Supported";
  return "Emerging";
}

export function sourceLabel(sourceType: CareerMemoryView["sourceType"]): string {
  switch (sourceType) {
    case "USER_DECLARED":
      return "You told CareerOS";
    case "USER_CORRECTED":
      return "You corrected this";
    case "M21_RESUME":
      return "Observed from resume activity";
    case "M22_APPLICATION":
      return "Observed from applications";
    case "M23_JOBS":
      return "Observed from job search";
    case "M24_COMMUNICATION":
      return "Observed from communications";
    case "M25_LINKEDIN":
      return "Observed from LinkedIn";
    case "M26_DAILY":
      return "Inferred from repeated daily activity";
    case "M27_WEEKLY":
      return "Supported by finalized weekly reviews";
    default:
      return "Inferred from repeated activity";
  }
}

export function toMemoryView(
  row: careerMemory & { evidence?: careerMemoryEvidence[] },
): CareerMemoryView {
  const evidence = row.evidence ?? [];
  const why = evidence.slice(0, 5).map((item) => {
    const payload = asRecord(item.evidenceJson);
    if (typeof payload.summary === "string") return payload.summary;
    return `${item.evidenceType.replaceAll("_", " ").toLowerCase()} on ${item.observedAt.toISOString().slice(0, 10)}`;
  });
  if (row.lastConfirmedAt) {
    why.push(`Last confirmed ${row.lastConfirmedAt.toISOString().slice(0, 10)}`);
  }
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    subjectKey: row.subjectKey,
    normalizedValueKey: row.normalizedValueKey,
    value: asRecord(row.valueJson),
    normalizedText: row.normalizedText,
    semanticKey: row.semanticKey,
    status: row.status,
    confidence: row.confidence,
    confidenceLabel: confidenceLabel(row.confidence),
    importance: row.importance,
    sourceType: row.sourceType,
    sourceLabel: sourceLabel(row.sourceType),
    firstObservedAt: row.firstObservedAt.toISOString(),
    lastObservedAt: row.lastObservedAt.toISOString(),
    lastConfirmedAt: row.lastConfirmedAt?.toISOString() ?? null,
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    isUserDeclared: row.isUserDeclared,
    isUserCorrected: row.isUserCorrected,
    whyRemembered: why,
    evidenceCount: evidence.length,
  };
}
