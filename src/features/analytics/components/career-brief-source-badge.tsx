import type { CareerBriefSource } from "../ai/types";

type CareerBriefSourceBadgeProps = {
  source: CareerBriefSource;
  isStale?: boolean;
  className?: string;
};

export function CareerBriefSourceBadge({
  source,
  isStale = false,
  className = "",
}: CareerBriefSourceBadgeProps) {
  const isAi = source === "ai" && !isStale;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${
        isAi
          ? "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]"
          : "border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] text-[var(--color-text-secondary)]"
      } ${className}`}
    >
      {isStale ? "Needs refresh" : isAi ? "AI brief" : "Rule-based fallback"}
    </span>
  );
}
