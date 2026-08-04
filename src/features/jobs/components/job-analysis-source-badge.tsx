import type { JobAnalysisSource } from "../types";

type JobAnalysisSourceBadgeProps = {
  source: JobAnalysisSource;
  className?: string;
};

export function JobAnalysisSourceBadge({
  source,
  className = "",
}: JobAnalysisSourceBadgeProps) {
  const isAi = source === "ai";

  return (
    <span
      className={`status-chip status-chip--mono ${
        isAi ? "status-chip--info" : "status-chip--neutral"
      } ${className}`}
    >
      {isAi ? "AI match" : "Rule-based fallback"}
    </span>
  );
}
