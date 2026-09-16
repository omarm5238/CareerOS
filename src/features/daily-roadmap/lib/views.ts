import type {
  DailyRoadmapActionType,
  DailyRoadmapPriorityBand,
} from "@/generated/prisma/client";

import type { DailyRoadmapActionView } from "../types";

export function priorityBandFromScore(score: number): DailyRoadmapPriorityBand {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= 85) return "CRITICAL";
  if (clamped >= 70) return "HIGH";
  if (clamped >= 50) return "MEDIUM";
  return "LOW";
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function bucketMinutes(value: number): 5 | 10 | 15 | 30 | 45 | 60 | 90 {
  const buckets = [5, 10, 15, 30, 45, 60, 90] as const;
  let best: (typeof buckets)[number] = 15;
  let delta = Number.POSITIVE_INFINITY;
  for (const bucket of buckets) {
    const next = Math.abs(bucket - value);
    if (next < delta) {
      best = bucket;
      delta = next;
    }
  }
  return best;
}

export function primaryActionLabel(type: DailyRoadmapActionType, blockedReason?: string | null): string {
  if (blockedReason && type === "LINKEDIN_PUBLISH") {
    return "Reconnect LinkedIn";
  }

  switch (type) {
    case "JOB_REVIEW":
      return "Review Job";
    case "JOB_PREPARE":
      return "Prepare Application";
    case "JOB_APPLY":
      return "Open Application";
    case "APPLICATION_FOLLOW_UP":
    case "APPLICATION_NEXT_STEP":
      return "Open Application";
    case "INTERVIEW_PREP":
      return "Open Application";
    case "ASSESSMENT_PREP":
      return "Open Application";
    case "RESUME_REVIEW":
      return "Review Resume";
    case "COMMUNICATION_REVIEW":
      return "Review Draft";
    case "LINKEDIN_POST_REVIEW":
      return "Review LinkedIn Post";
    case "LINKEDIN_PUBLISH":
      return "Publish to LinkedIn";
    case "LINKEDIN_ANALYTICS_REVIEW":
      return "Review LinkedIn Analytics";
    case "LINKEDIN_RECONNECT":
      return "Reconnect LinkedIn";
    case "SKILL_DEVELOPMENT":
    case "EVIDENCE_BUILDING":
      return "Continue Skill Work";
    case "PROFILE_IMPROVEMENT":
      return "Review LinkedIn Strategy";
    case "WEEKLY_PREP":
      return "Open Workspace";
    case "CUSTOM_CAREER_ACTION":
      return "Continue";
    default:
      return "Continue";
  }
}

export function toActionView(action: {
  id: string;
  type: DailyRoadmapActionType;
  origin: DailyRoadmapActionView["origin"];
  sourceEntityType: DailyRoadmapActionView["sourceEntityType"];
  sourceEntityId: string | null;
  title: string;
  summary: string | null;
  whyNow: string | null;
  priorityBand: DailyRoadmapPriorityBand;
  estimatedMinutes: number;
  status: DailyRoadmapActionView["status"];
  isMeaningful: boolean;
  isActionable: boolean;
  blockedReason: string | null;
  sortOrder: number;
  deferredUntil: string | null;
  completedAt: Date | null;
  completionSource: DailyRoadmapActionView["completionSource"];
  deepLink: string | null;
  fingerprint: string;
}): DailyRoadmapActionView {
  return {
    id: action.id,
    type: action.type,
    origin: action.origin,
    sourceEntityType: action.sourceEntityType,
    sourceEntityId: action.sourceEntityId,
    title: action.title,
    summary: action.summary,
    whyNow: action.whyNow,
    priorityBand: action.priorityBand,
    estimatedMinutes: action.estimatedMinutes,
    status: action.status,
    isMeaningful: action.isMeaningful,
    isActionable: action.isActionable,
    blockedReason: action.blockedReason,
    sortOrder: action.sortOrder,
    deferredUntil: action.deferredUntil,
    completedAt: action.completedAt?.toISOString() ?? null,
    completionSource: action.completionSource,
    deepLink: action.deepLink,
    primaryActionLabel: primaryActionLabel(action.type, action.blockedReason),
    fingerprint: action.fingerprint,
  };
}
