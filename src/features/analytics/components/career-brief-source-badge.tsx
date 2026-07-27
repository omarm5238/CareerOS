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
          ? "border-[rgb(99_102_241_/_35%)] bg-[rgb(99_102_241_/_12%)] text-[var(--color-accent)]"
          : "border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] text-[var(--color-text-secondary)]"
      } ${className}`}
    >
      {isStale ? "Needs refresh" : isAi ? "AI brief" : "Rule-based fallback"}
    </span>
  );
}
