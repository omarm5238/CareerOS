import type { AnalysisSource } from "../types";

type AnalysisSourceBadgeProps = {
  source: AnalysisSource;
  className?: string;
};

export function AnalysisSourceBadge({ source, className = "" }: AnalysisSourceBadgeProps) {
  const isAi = source === "ai";

  return (
    <span
      className={`status-chip status-chip--mono ${
        isAi ? "status-chip--info" : "status-chip--neutral"
      } ${className}`}
    >
      {isAi ? "AI analysis" : "Rule-based fallback"}
    </span>
  );
}
