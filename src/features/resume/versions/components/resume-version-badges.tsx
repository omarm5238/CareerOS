const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  USED: "Used",
  ARCHIVED: "Archived",
};

const STATUS_TONES: Record<string, string> = {
  DRAFT: "status-chip--info",
  READY: "status-chip--success",
  USED: "status-chip--neutral",
  ARCHIVED: "status-chip--warning",
};

const SOURCE_LABELS: Record<string, string> = {
  AI_GENERATED: "AI generated",
  USER_EDITED: "Manually edited",
  RULE_BASED_FALLBACK: "Rule-based fallback",
  IMPORTED: "Imported",
};

const SOURCE_TONES: Record<string, string> = {
  AI_GENERATED: "status-chip--info",
  USER_EDITED: "status-chip--neutral",
  RULE_BASED_FALLBACK: "status-chip--warning",
  IMPORTED: "status-chip--neutral",
};

const STRENGTH_LABELS: Record<string, string> = {
  strong: "Strong evidence",
  medium: "Medium evidence",
  weak: "Weak evidence",
  none: "No evidence",
};

const STRENGTH_TONES: Record<string, string> = {
  strong: "status-chip--success",
  medium: "status-chip--info",
  weak: "status-chip--warning",
  none: "status-chip--danger",
};

const SEVERITY_TONES: Record<string, string> = {
  low: "status-chip--neutral",
  medium: "status-chip--info",
  high: "status-chip--warning",
};

const KEYWORD_ACTION_LABELS: Record<string, string> = {
  use_safely: "Use safely",
  rephrase_existing_evidence: "Rephrase existing evidence",
  move_higher: "Move higher",
  add_to_project_evidence: "Add to project evidence",
  keep_out_of_resume: "Keep out of resume",
  add_to_roadmap: "Add to roadmap",
};

export function resumeVersionStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function resumeVersionSourceLabel(source: string | null): string {
  if (!source) return "Unknown source";
  return SOURCE_LABELS[source] ?? source;
}

export function keywordActionLabel(action: string): string {
  return KEYWORD_ACTION_LABELS[action] ?? action;
}

export function ResumeVersionStatusChip({ status }: { status: string }) {
  return (
    <span className={`status-chip ${STATUS_TONES[status] ?? "status-chip--neutral"}`}>
      {resumeVersionStatusLabel(status)}
    </span>
  );
}

/** The model is only meaningful for AI-generated revisions, never for manual edits. */
export function resumeVersionModelLabel(
  source: string | null,
  model: string | null | undefined,
): string | null {
  if (source !== "AI_GENERATED" || !model) return null;
  return model;
}

export function ResumeVersionSourceBadge({
  source,
  model,
}: {
  source: string | null;
  model?: string | null;
}) {
  const modelLabel = resumeVersionModelLabel(source, model);

  return (
    <span className={`status-chip ${SOURCE_TONES[source ?? ""] ?? "status-chip--neutral"}`}>
      {resumeVersionSourceLabel(source)}
      {modelLabel ? ` · ${modelLabel}` : ""}
    </span>
  );
}

export function EvidenceStrengthChip({ strength }: { strength: string }) {
  return (
    <span className={`status-chip ${STRENGTH_TONES[strength] ?? "status-chip--neutral"}`}>
      {STRENGTH_LABELS[strength] ?? strength}
    </span>
  );
}

export function WarningSeverityChip({ severity }: { severity: string }) {
  return (
    <span className={`status-chip ${SEVERITY_TONES[severity] ?? "status-chip--neutral"}`}>
      {severity}
    </span>
  );
}

export function formatResumeVersionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
