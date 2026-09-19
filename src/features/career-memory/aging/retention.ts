import type { CareerMemoryType } from "../types";

export const RETENTION_DAYS = {
  EVIDENCE_SIGNAL: 90,
  CAREER_PATTERN: 60,
  BEHAVIOR_PATTERN: 45,
  FOCUS: 60,
} as const;

export function retentionDaysFor(type: CareerMemoryType, sourceType: string): number | null {
  if (sourceType === "USER_DECLARED" || sourceType === "USER_CORRECTED") return null;
  if (type === "PREFERENCE" || type === "GOAL" || type === "CONSTRAINT" || type === "MILESTONE") return null;
  if (type === "SKILL_SIGNAL") return null;
  if (type === "EVIDENCE_SIGNAL") return RETENTION_DAYS.EVIDENCE_SIGNAL;
  if (type === "CAREER_PATTERN") return RETENTION_DAYS.CAREER_PATTERN;
  if (type === "BEHAVIOR_PATTERN") return RETENTION_DAYS.BEHAVIOR_PATTERN;
  if (type === "FOCUS") return RETENTION_DAYS.FOCUS;
  return 90;
}
