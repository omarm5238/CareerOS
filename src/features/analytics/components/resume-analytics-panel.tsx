import Link from "next/link";

import { AnalysisSourceBadge } from "@/features/resume/components/analysis-source-badge";

import type { AnalyticsResumeMetrics } from "../types";

type ResumeAnalyticsPanelProps = {
  resume: AnalyticsResumeMetrics;
};

export function ResumeAnalyticsPanel({ resume }: ResumeAnalyticsPanelProps) {
  return (
    <section
      aria-labelledby="resume-analytics-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-analytics-heading"
      >
        Resume Analytics
      </h2>

      {!resume.hasResume ? (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          No resume analysis available yet.
        </p>
      ) : (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <MetricItem label="Latest role" value={resume.latestRole ?? "—"} />
          <MetricItem
            label="Experience level"
            value={resume.latestExperienceLevel ?? "—"}
          />
          <MetricItem
            label="Completeness"
            value={
              resume.completenessScore !== null ? `${resume.completenessScore}%` : "—"
            }
          />
          <MetricItem
            label="Resume analyses"
            value={String(resume.resumeAnalysesCount)}
          />
          <MetricItem
            label="Detected skills"
            value={String(resume.detectedSkillsCount)}
          />
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-3">
            <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              Analysis source
            </dt>
            <dd className="mt-2">
              {resume.analysisSource ? (
                <AnalysisSourceBadge source={resume.analysisSource} />
              ) : (
                <span className="text-sm text-[var(--color-text-primary)]">—</span>
              )}
            </dd>
          </div>
        </dl>
      )}

      <Link
        className="mt-4 inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        href="/workspace/resume"
      >
        View Resume module
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
