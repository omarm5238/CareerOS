import type { SkillsInsightSource } from "../types";

type SkillsInsightSourceBadgeProps = {
  source: SkillsInsightSource;
  isStale?: boolean;
  className?: string;
};

export function SkillsInsightSourceBadge({
  source,
  isStale = false,
  className = "",
}: SkillsInsightSourceBadgeProps) {
  const isAi = source === "ai";

  return (
    <span
      className={`status-chip status-chip--mono ${
        isStale
          ? "status-chip--warning"
          : isAi
            ? "status-chip--info"
            : "status-chip--neutral"
      } ${className}`}
    >
      {isStale ? "Needs refresh" : isAi ? "AI strategy" : "Rule-based fallback"}
    </span>
  );
}
