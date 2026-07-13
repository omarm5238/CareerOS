import Link from "next/link";

import type { AnalyticsJobsMetrics } from "../types";

type JobsAnalyticsPanelProps = {
  jobs: AnalyticsJobsMetrics;
};

function formatScore(value: number | null): string {
  if (value === null) return "—";
  return `${value}%`;
}

export function JobsAnalyticsPanel({ jobs }: JobsAnalyticsPanelProps) {
  return (
    <section
      aria-labelledby="jobs-analytics-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="jobs-analytics-heading"
      >
        Jobs Analytics
      </h2>

      {jobs.savedJobsCount === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          No saved jobs yet. Add jobs to track match quality and alignment.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricItem label="Saved jobs" value={String(jobs.savedJobsCount)} />
            <MetricItem label="Best match" value={formatScore(jobs.bestMatchScore)} />
            <MetricItem label="Average match" value={formatScore(jobs.averageMatchScore)} />
            <MetricItem label="Weakest match" value={formatScore(jobs.weakestMatchScore)} />
          </dl>

          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Application status
            </h3>
            <ul className="mt-2 space-y-2">
              <DistributionItem count={jobs.savedStatusCount} label="Saved" tone="partial" />
              <DistributionItem count={jobs.appliedStatusCount} label="Applied" tone="strong" />
              <DistributionItem
                count={jobs.interviewStatusCount}
                label="Interview"
                tone="partial"
              />
              <DistributionItem count={jobs.offerStatusCount} label="Offer" tone="strong" />
              <DistributionItem count={jobs.rejectedStatusCount} label="Rejected" tone="weak" />
            </ul>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Match distribution
            </h3>
            <ul className="mt-2 space-y-2">
              <DistributionItem
                count={jobs.strongMatchesCount}
                label="Strong matches"
                tone="strong"
              />
              <DistributionItem
                count={jobs.partialMatchesCount}
                label="Partial matches"
                tone="partial"
              />
              <DistributionItem
                count={jobs.weakMatchesCount}
                label="Weak matches"
                tone="weak"
              />
            </ul>
          </div>
        </>
      )}

      <Link
        className="mt-4 inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        href="/workspace/jobs"
      >
        View Jobs module
      </Link>
    </section>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-3">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}

function DistributionItem({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "strong" | "partial" | "weak";
}) {
  const toneStyles = {
    strong: "text-[rgb(134_239_172)]",
    partial: "text-[rgb(165_180_252)]",
    weak: "text-[rgb(252_165_165)]",
  };

  return (
    <li className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] px-3 py-2">
      <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
      <span className={`text-sm font-medium ${toneStyles[tone]}`}>{count}</span>
    </li>
  );
}
