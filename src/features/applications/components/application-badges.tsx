import type {
  ApplicationInsightSource,
  ApplicationNextActionSource,
  ApplicationStatus,
} from "@/generated/prisma/client";

import { APPLICATION_STATUS_SHORT_LABELS } from "../lib/application-state";

const STATUS_TONES: Record<ApplicationStatus, string> = {
  DRAFT: "status-chip--neutral",
  APPLIED: "status-chip--info",
  SCREENING: "status-chip--info",
  ASSESSMENT: "status-chip--warning",
  INTERVIEW: "status-chip--warning",
  OFFER: "status-chip--success",
  ACCEPTED: "status-chip--success",
  REJECTED: "status-chip--danger",
  WITHDRAWN: "status-chip--neutral",
};

export function ApplicationStatusChip({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`status-chip ${STATUS_TONES[status]}`}>
      {APPLICATION_STATUS_SHORT_LABELS[status]}
    </span>
  );
}

const NEXT_ACTION_SOURCE_LABELS: Record<ApplicationNextActionSource, string> = {
  USER: "You set this",
  RULE_BASED: "Rule-based",
  AI: "AI",
};

export function ApplicationNextActionSourceBadge({
  source,
}: {
  source: ApplicationNextActionSource | null;
}) {
  if (!source) return null;

  return (
    <span
      className={`status-chip ${
        source === "AI" ? "status-chip--info" : "status-chip--neutral"
      }`}
    >
      {NEXT_ACTION_SOURCE_LABELS[source]}
    </span>
  );
}

export function ApplicationInsightSourceBadge({
  source,
  model,
}: {
  source: ApplicationInsightSource;
  model?: string | null;
}) {
  const isAi = source === "AI_GENERATED";

  return (
    <span className={`status-chip ${isAi ? "status-chip--info" : "status-chip--neutral"}`}>
      {isAi ? "AI generated" : "Rule-based fallback"}
      {isAi && model ? ` · ${model}` : ""}
    </span>
  );
}

export function ApplicationConfidenceChip({
  confidence,
}: {
  confidence: "low" | "medium" | "high";
}) {
  const tone =
    confidence === "high"
      ? "status-chip--warning"
      : confidence === "medium"
        ? "status-chip--neutral"
        : "status-chip--neutral";

  return <span className={`status-chip ${tone}`}>{confidence} confidence</span>;
}

export function formatApplicationDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatApplicationDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative-ish helper used for due dates so overdue items read clearly. */
export function describeDueDate(value: string | null, now: Date = new Date()): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);

  if (days < 0) return `Overdue · ${formatApplicationDate(value)}`;
  if (days === 0) return `Due today`;
  if (days === 1) return `Due tomorrow`;
  return `Due ${formatApplicationDate(value)}`;
}
