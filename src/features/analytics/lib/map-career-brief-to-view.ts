import type { careerBriefModel } from "@/generated/prisma/models/careerBrief";

import { sanitizeCareerExecutionPlan } from "./build-career-execution-plan";
import { sanitizeActionCenterSections } from "./build-deterministic-action-center";
import type { CareerBriefView } from "../types";
import type { CareerBriefActionCenterSection } from "../ai/types";

function parseJsonArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

function splitWarnings(value: unknown): {
  warnings: string[];
  dataSourceNotes: string[];
} {
  const warnings: string[] = [];
  const dataSourceNotes: string[] = [];
  for (const item of parseJsonArray<unknown>(value)) {
    if (typeof item !== "string") continue;
    if (item.startsWith("[data-note] ")) {
      dataSourceNotes.push(item.slice(12));
    } else if (
      /\b(based on|generated from|analysis based|skills detected from)\b/i.test(
        item,
      ) &&
      !/\b(no |lacks?|limited|changed|stale|missing)\b/i.test(item)
    ) {
      dataSourceNotes.push(item);
    } else {
      warnings.push(item);
    }
  }
  return { warnings, dataSourceNotes };
}

export function mapCareerBriefToView(
  record: careerBriefModel,
  freshness?: { isStale: boolean; staleReason: string | null },
): CareerBriefView {
  const executionPlan = sanitizeCareerExecutionPlan(record.thirtyDayPlan);
  const thirtyDayPlan =
    executionPlan?.weeks.map((week) => ({
      week: week.week,
      focus: week.focus,
      outcome: week.outcome,
    })) ??
    (Array.isArray(record.thirtyDayPlan)
      ? parseJsonArray(record.thirtyDayPlan)
      : []);
  const notes = splitWarnings(record.warnings);

  return {
    id: record.id,
    analysisSource: record.analysisSource === "ai" ? "ai" : "rule_based",
    aiModel: record.aiModel,
    healthScore: record.healthScore,
    headline: record.headline,
    summary: record.summary,
    topRisks: parseJsonArray(record.topRisks),
    topOpportunities: parseJsonArray(record.topOpportunities),
    nextActions: parseJsonArray(record.nextActions),
    thirtyDayPlan,
    careerExecutionPlan: executionPlan,
    actionCenter: sanitizeActionCenterSections(
      parseJsonArray<CareerBriefActionCenterSection>(record.actionCenter),
    ),
    warnings: notes.warnings,
    dataSourceNotes: notes.dataSourceNotes,
    generatedAt: record.createdAt.toISOString(),
    isStale: freshness?.isStale ?? false,
    staleReason: freshness?.staleReason ?? null,
  };
}
