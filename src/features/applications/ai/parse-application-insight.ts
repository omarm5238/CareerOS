import { APPLICATION_NEXT_ACTION_TYPES } from "../lib/application-permissions";
import type {
  ApplicationInsightConfidence,
  ApplicationInsightPriority,
  ApplicationLikelyFactor,
  ApplicationLikelyQuestion,
  ApplicationNextActionContent,
  ApplicationRejectionAnalysis,
  ApplicationStagePrep,
} from "../types";
import type { ApplicationNextActionType } from "@/generated/prisma/client";

export const APPLICATION_INSIGHT_LIMITS = {
  shortText: 200,
  mediumText: 400,
  longText: 900,
  focusAreas: 8,
  likelyQuestions: 8,
  evidence: 8,
  risks: 6,
  questionsToAsk: 6,
  checklist: 8,
  warnings: 6,
  likelyFactors: 6,
  lessons: 6,
  resumeChanges: 6,
  skillActions: 6,
  nextActions: 6,
} as const;

const CONFIDENCES = ["low", "medium", "high"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;
const DUE_SUGGESTIONS = ["today", "in_3_days", "in_1_week", "in_2_weeks"] as const;

type DueSuggestion = (typeof DUE_SUGGESTIONS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength).trimEnd()}…` : cleaned;
}

function textArray(value: unknown, maxItems: number, maxLength = APPLICATION_INSIGHT_LIMITS.mediumText): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const cleaned = text(item, maxLength);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }

  return result;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  const upper = allowed.find((item) => item.toLowerCase() === value.toLowerCase());
  return upper ?? fallback;
}

/**
 * The model is never allowed to pick a raw date. It selects a coarse bucket and
 * the server converts that into a real timestamp.
 */
export function resolveDueSuggestion(value: unknown, now: Date = new Date()): Date | null {
  const suggestion = typeof value === "string" ? value.toLowerCase().trim() : null;
  if (!suggestion || !(DUE_SUGGESTIONS as readonly string[]).includes(suggestion)) return null;

  const offsets: Record<DueSuggestion, number> = {
    today: 0,
    in_3_days: 3,
    in_1_week: 7,
    in_2_weeks: 14,
  };

  const due = new Date(now);
  due.setDate(due.getDate() + offsets[suggestion as DueSuggestion]);
  return due;
}

export function sanitizeNextActionOutput(payload: unknown): ApplicationNextActionContent | null {
  if (!isRecord(payload)) return null;
  const action = isRecord(payload.action) ? payload.action : null;
  if (!action) return null;

  const title = text(action.title, APPLICATION_INSIGHT_LIMITS.shortText);
  const reason = text(action.reason, APPLICATION_INSIGHT_LIMITS.longText);
  if (!title || !reason) return null;

  const type = enumValue<ApplicationNextActionType>(
    action.type,
    APPLICATION_NEXT_ACTION_TYPES,
    "OTHER",
  );

  const dueAt = resolveDueSuggestion(action.dueSuggestion);

  return {
    type,
    title,
    reason,
    priority: enumValue<ApplicationInsightPriority>(action.priority, PRIORITIES, "medium"),
    dueAt: dueAt ? dueAt.toISOString() : null,
    evidence: textArray(payload.evidence, APPLICATION_INSIGHT_LIMITS.evidence),
    warnings: textArray(payload.warnings, APPLICATION_INSIGHT_LIMITS.warnings),
  };
}

function sanitizeLikelyQuestions(value: unknown): ApplicationLikelyQuestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => ({
      question: text(item.question, APPLICATION_INSIGHT_LIMITS.mediumText),
      whyLikely: text(item.whyLikely, APPLICATION_INSIGHT_LIMITS.mediumText),
      evidenceToUse: text(item.evidenceToUse, APPLICATION_INSIGHT_LIMITS.mediumText),
    }))
    .filter((item) => item.question.length > 0)
    .slice(0, APPLICATION_INSIGHT_LIMITS.likelyQuestions);
}

export function sanitizeStagePrepOutput(
  payload: unknown,
  stage: ApplicationStagePrep["stage"],
): ApplicationStagePrep | null {
  if (!isRecord(payload)) return null;

  const summary = text(payload.summary, APPLICATION_INSIGHT_LIMITS.longText);
  const focusAreas = textArray(payload.focusAreas, APPLICATION_INSIGHT_LIMITS.focusAreas);
  const likelyQuestions = sanitizeLikelyQuestions(payload.likelyQuestions);
  const checklist = textArray(payload.checklist, APPLICATION_INSIGHT_LIMITS.checklist);

  // Require real substance, otherwise fall back to the deterministic draft.
  if (!summary || (focusAreas.length === 0 && likelyQuestions.length === 0 && checklist.length === 0)) {
    return null;
  }

  return {
    stage,
    summary,
    focusAreas,
    likelyQuestions,
    evidenceToEmphasize: textArray(payload.evidenceToEmphasize, APPLICATION_INSIGHT_LIMITS.evidence),
    risks: textArray(payload.risks, APPLICATION_INSIGHT_LIMITS.risks),
    questionsToAsk: textArray(payload.questionsToAsk, APPLICATION_INSIGHT_LIMITS.questionsToAsk),
    checklist,
    warnings: textArray(payload.warnings, APPLICATION_INSIGHT_LIMITS.warnings),
  };
}

function sanitizeLikelyFactors(value: unknown): ApplicationLikelyFactor[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => ({
      factor: text(item.factor, APPLICATION_INSIGHT_LIMITS.mediumText),
      evidence: text(item.evidence, APPLICATION_INSIGHT_LIMITS.longText),
      confidence: enumValue<ApplicationInsightConfidence>(item.confidence, CONFIDENCES, "low"),
    }))
    .filter((item) => item.factor.length > 0)
    .slice(0, APPLICATION_INSIGHT_LIMITS.likelyFactors);
}

/**
 * Sanitizes rejection analysis.
 *
 * `confirmedReason` is overwritten with the stored user-confirmed fact rather
 * than trusted from the model, so AI inference can never be promoted into the
 * confirmed-fact field even if the model ignores its instructions.
 */
export function sanitizeRejectionOutput(
  payload: unknown,
  confirmedReason: string | null,
): ApplicationRejectionAnalysis | null {
  if (!isRecord(payload)) return null;

  const likelyFactors = sanitizeLikelyFactors(payload.likelyFactors);
  const lessons = textArray(payload.lessons, APPLICATION_INSIGHT_LIMITS.lessons);
  const nextActions = textArray(payload.nextActions, APPLICATION_INSIGHT_LIMITS.nextActions);

  if (likelyFactors.length === 0 && lessons.length === 0 && nextActions.length === 0) {
    return null;
  }

  return {
    confirmedReason,
    likelyFactors,
    whatWorked: textArray(payload.whatWorked, APPLICATION_INSIGHT_LIMITS.evidence),
    lessons,
    resumeChanges: textArray(payload.resumeChanges, APPLICATION_INSIGHT_LIMITS.resumeChanges),
    skillActions: textArray(payload.skillActions, APPLICATION_INSIGHT_LIMITS.skillActions),
    nextActions,
    warnings: textArray(payload.warnings, APPLICATION_INSIGHT_LIMITS.warnings),
  };
}
