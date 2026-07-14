import type { JobMatchAnalysis } from "../types";

type JobAiInsightsProps = {
  analysis: JobMatchAnalysis;
};

export function JobAiInsights({ analysis }: JobAiInsightsProps) {
  const hasInsights =
    !!analysis.fitSummary ||
    analysis.applicationStrategy.length > 0 ||
    analysis.resumeTailoringTips.length > 0;

  if (!hasInsights) return null;

  return (
    <section
      aria-labelledby="job-ai-insights-heading"
      className="rounded-[var(--radius-xl)] border border-[rgb(99_102_241_/_16%)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="job-ai-insights-heading"
      >
        AI Insights
      </h2>

      {analysis.fitSummary ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Fit summary</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {analysis.fitSummary}
          </p>
        </div>
      ) : null}

      <InsightList
        items={analysis.applicationStrategy}
        label="Application strategy"
      />
      <InsightList
        items={analysis.resumeTailoringTips}
        label="Resume tailoring tips"
      />
    </section>
  );
}

function InsightList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{label}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li
            className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] px-3 py-2 text-sm leading-6 text-[var(--color-text-secondary)]"
            key={item}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
