import type { CareerExecutionPlan } from "../types/execution-plan";
import { canonicalizeActionTitle } from "@/features/shared/insights";
import { sanitizeCareerExecutionPlan } from "../lib/build-career-execution-plan";
import { sanitizeActionCenterSections } from "../lib/build-deterministic-action-center";
import type {
  CareerBriefActionCategory,
  CareerBriefActionCenterSection,
  CareerBriefActionSection,
  CareerBriefAIPayload,
  CareerBriefNextAction,
  CareerBriefPlanItem,
  CareerBriefResult,
  CareerBriefRisk,
  CareerBriefSeverity,
} from "./types";

const SEVERITIES: CareerBriefSeverity[] = ["High", "Medium", "Low"];
const CATEGORIES: CareerBriefActionCategory[] = ["Skills", "Resume", "Jobs", "Applications"];
const SECTIONS: CareerBriefActionSection[] = [
  "Today",
  "This Week",
  "Resume Fixes",
  "Skill Proof Needed",
  "Job Actions",
  "Interview Prep",
  "Portfolio Proof",
  "Job Follow-ups",
];

const LIMITS = {
  headline: 140,
  summary: 900,
  topRisks: 3,
  nextActions: 3,
  thirtyDayPlan: 4,
  actionCenterSections: 5,
  actionCenterItems: 5,
  warnings: 5,
  stringField: 400,
} as const;

export const CAREER_BRIEF_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "summaryTitle",
    "summary",
    "healthScore",
    "risks",
    "nextActions",
    "actionCenter",
    "thirtyDayPlan",
    "warnings",
    "dataSourceNotes",
  ],
  properties: {
    summaryTitle: { type: "string" },
    summary: { type: "string" },
    healthScore: { type: "integer", minimum: 0, maximum: 100 },
    risks: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "reason", "severity"],
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          severity: { type: "string", enum: SEVERITIES },
        },
      },
    },
    nextActions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "category", "priority", "reason"],
        properties: {
          title: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          priority: { type: "string", enum: SEVERITIES },
          reason: { type: "string" },
        },
      },
    },
    actionCenter: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "items"],
        properties: {
          section: {
            type: "string",
            enum: [
              "Job Actions",
              "Resume Fixes",
              "Skill Proof Needed",
              "Portfolio Proof",
              "Interview Prep",
            ],
          },
          items: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "reason", "priority"],
              properties: {
                title: { type: "string" },
                reason: { type: "string" },
                priority: { type: "string", enum: SEVERITIES },
              },
            },
          },
        },
      },
    },
    thirtyDayPlan: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["week", "focus", "outcome"],
        properties: {
          week: { type: "string" },
          focus: { type: "string" },
          outcome: { type: "string" },
        },
      },
    },
    warnings: { type: "array", maxItems: 3, items: { type: "string" } },
    dataSourceNotes: { type: "array", maxItems: 4, items: { type: "string" } },
  },
};

function sanitizeString(value: unknown, fallback = "", max: number = LIMITS.stringField): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

function sanitizeStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    items.push(trimmed.slice(0, LIMITS.stringField));
    if (items.length >= max) break;
  }
  return items;
}

function sanitizeScore(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return Math.min(100, Math.max(0, parsed));
    }
  }
  return 0;
}

function sanitizeSeverity(value: unknown): CareerBriefSeverity {
  if (typeof value !== "string") return "Medium";
  const normalized = value.trim();
  if (SEVERITIES.includes(normalized as CareerBriefSeverity)) {
    return normalized as CareerBriefSeverity;
  }
  return "Medium";
}

function sanitizeCategory(value: unknown): CareerBriefActionCategory {
  if (typeof value !== "string") return "Skills";
  const normalized = value.trim();
  if (CATEGORIES.includes(normalized as CareerBriefActionCategory)) {
    return normalized as CareerBriefActionCategory;
  }
  return "Skills";
}

function sanitizeSection(value: unknown): CareerBriefActionSection | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized === "Before Applying") return "Job Actions";
  if (SECTIONS.includes(normalized as CareerBriefActionSection)) {
    return normalized as CareerBriefActionSection;
  }
  return null;
}

function sanitizeRisks(value: unknown): CareerBriefRisk[] {
  if (!Array.isArray(value)) return [];
  const items: CareerBriefRisk[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const rawTitle = sanitizeString(record.title, "", 120);
    if (!rawTitle) continue;
    const title = canonicalizeActionTitle(rawTitle);
    items.push({
      title,
      reason: sanitizeString(record.reason, "Based on your current CareerOS data."),
      severity: sanitizeSeverity(record.severity),
    });
    if (items.length >= LIMITS.topRisks) break;
  }
  return items;
}

function sanitizeNextActions(value: unknown): CareerBriefNextAction[] {
  if (!Array.isArray(value)) return [];
  const items: CareerBriefNextAction[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const rawTitle = sanitizeString(record.title, "", 120);
    if (!rawTitle) continue;
    const title = canonicalizeActionTitle(rawTitle);
    items.push({
      title,
      category: sanitizeCategory(record.category),
      priority: sanitizeSeverity(record.priority),
      reason: sanitizeString(record.reason, "Recommended based on current CareerOS signals."),
    });
    if (items.length >= LIMITS.nextActions) break;
  }
  return items;
}

function sanitizePlan(value: unknown): CareerBriefPlanItem[] {
  if (!Array.isArray(value)) return [];
  const items: CareerBriefPlanItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const week = sanitizeString(record.week, "", 40);
    if (!week) continue;
    items.push({
      week,
      focus: sanitizeString(record.focus, "Focus on the highest-impact gap."),
      outcome: sanitizeString(record.outcome, "Produce one concrete artifact or update."),
    });
    if (items.length >= LIMITS.thirtyDayPlan) break;
  }
  return items;
}

function sanitizeActionCenter(value: unknown): CareerBriefActionCenterSection[] {
  if (!Array.isArray(value)) return [];
  const sections: CareerBriefActionCenterSection[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const section = sanitizeSection(record.section);
    if (!section) continue;

    const items: CareerBriefActionCenterSection["items"] = [];
    if (Array.isArray(record.items)) {
      for (const item of record.items) {
        if (!item || typeof item !== "object") continue;
        const itemRecord = item as Record<string, unknown>;
        const rawTitle = sanitizeString(itemRecord.title, "", 120);
        if (!rawTitle) continue;
        const title = canonicalizeActionTitle(rawTitle);
        items.push({
          title,
          reason: sanitizeString(itemRecord.reason, "Matters for your current readiness."),
          priority: sanitizeSeverity(itemRecord.priority),
        });
        if (items.length >= LIMITS.actionCenterItems) break;
      }
    }

    if (items.length === 0) continue;
    sections.push({ section, items });
    if (sections.length >= LIMITS.actionCenterSections) break;
  }

  return sanitizeActionCenterSections(sections).slice(0, LIMITS.actionCenterSections);
}

export function sanitizeCareerBriefAIAnalysis(
  payload: CareerBriefAIPayload,
  model: string,
): CareerBriefResult | null {
  const healthScore = sanitizeScore(payload.healthScore);
  const headline = sanitizeString(payload.summaryTitle, "", LIMITS.headline);
  const summary = sanitizeString(payload.summary, "", LIMITS.summary);
  const topRisks = sanitizeRisks(payload.risks);
  const topOpportunities: CareerBriefResult["topOpportunities"] = [];
  const nextActions = sanitizeNextActions(payload.nextActions);
  const thirtyDayPlan = sanitizePlan(payload.thirtyDayPlan);
  const careerExecutionPlan =
    sanitizeCareerExecutionPlan(payload.thirtyDayPlan) ??
    ({
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      totalEstimatedHours: 0,
      weeks: thirtyDayPlan.map((item) => ({
        week: item.week,
        focus: item.focus,
        outcome: item.outcome,
        totalHours: 0,
      })),
      days: [],
    } satisfies CareerExecutionPlan);

  const weekSummaries =
    careerExecutionPlan.weeks.length > 0
      ? careerExecutionPlan.weeks.map((week) => ({
          week: week.week,
          focus: week.focus,
          outcome: week.outcome,
        }))
      : thirtyDayPlan;

  const actionCenter = sanitizeActionCenter(payload.actionCenter);
  const warnings = sanitizeStringArray(payload.warnings, LIMITS.warnings);
  const dataSourceNotes = sanitizeStringArray(payload.dataSourceNotes, 4);

  if (!headline && !summary && topRisks.length === 0 && nextActions.length === 0) {
    return null;
  }

  return {
    healthScore,
    headline: headline || "Career readiness snapshot",
    summary: summary || "Based on your current CareerOS data.",
    topRisks,
    topOpportunities,
    nextActions,
    thirtyDayPlan: weekSummaries.slice(0, 4),
    careerExecutionPlan,
    actionCenter,
    warnings,
    dataSourceNotes,
    analysisSource: "ai",
    aiModel: model,
  };
}

export function isValidCareerBriefResult(result: CareerBriefResult): boolean {
  return (
    result.healthScore >= 0 &&
    result.healthScore <= 100 &&
    result.headline.length > 0 &&
    (result.nextActions.length > 0 ||
      result.actionCenter.length > 0 ||
      result.topRisks.length > 0 ||
      result.summary.length > 0)
  );
}
