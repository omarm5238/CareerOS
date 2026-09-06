import type {
  CommunicationLanguage,
  CommunicationRevisionSource,
  CommunicationStatus,
} from "@/generated/prisma/client";

import { COMMUNICATION_LANGUAGE_LABELS, COMMUNICATION_STATUS_LABELS } from "../types";

const STATUS_TONES: Record<CommunicationStatus, string> = {
  DRAFT: "status-chip--neutral",
  READY: "status-chip--success",
  USED: "status-chip--info",
  ARCHIVED: "status-chip--neutral",
};

export function CommunicationStatusChip({ status }: { status: CommunicationStatus }) {
  return (
    <span className={`status-chip ${STATUS_TONES[status]}`}>
      {COMMUNICATION_STATUS_LABELS[status]}
    </span>
  );
}

export function CommunicationLanguageChip({ language }: { language: CommunicationLanguage }) {
  return (
    <span className="status-chip status-chip--mono">{COMMUNICATION_LANGUAGE_LABELS[language]}</span>
  );
}

export function CommunicationSourceBadge({
  source,
  model,
}: {
  source: CommunicationRevisionSource;
  model?: string | null;
}) {
  if (source === "RULE_BASED_FALLBACK") {
    return <span className="status-chip status-chip--neutral">Rule-based fallback</span>;
  }
  if (source === "USER_EDITED") {
    return <span className="status-chip status-chip--mono">User edited</span>;
  }
  return (
    <span className="status-chip status-chip--info">
      AI generated{model ? ` · ${model}` : ""}
    </span>
  );
}

export function formatCommunicationDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatCommunicationDateTime(value: string | null): string {
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
