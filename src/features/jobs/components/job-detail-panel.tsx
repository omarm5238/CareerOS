import Link from "next/link";

import type { JobDetailView } from "../types";
import { JobApplicationTracker } from "./job-application-tracker";
import { formatJobCreatedAt, JobMatchSummary } from "./job-match-summary";
import { JobRecommendations } from "./job-recommendations";

type JobDetailPanelProps = {
  job: JobDetailView;
};

export function JobDetailPanel({ job }: JobDetailPanelProps) {
  const preview =
    job.description.length > 420
      ? `${job.description.slice(0, 420).trimEnd()}…`
      : job.description;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
          Job detail
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          {job.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {job.company}
          {job.location ? ` · ${job.location}` : ""}
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {job.source ? <MetaItem label="Source" value={job.source} /> : null}
          <MetaItem label="Saved on" value={formatJobCreatedAt(job.createdAt)} />
        </dl>

        {job.jobUrl ? (
          <p className="mt-3 text-sm">
            <Link
              className="text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href={job.jobUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open job URL
            </Link>
          </p>
        ) : null}

        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
            Description preview
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-primary)]">
            {preview}
          </p>
        </div>
      </section>

      <JobApplicationTracker job={job} />

      {job.analysis ? (
        <>
          <JobMatchSummary
            matchScore={job.analysis.matchScore}
            matchedSkills={job.analysis.matchedSkills}
            missingSkills={job.analysis.missingSkills}
            roleAlignment={job.analysis.roleAlignment}
          />
          <JobRecommendations recommendations={job.analysis.recommendations} />
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No match analysis is available for this job.
        </p>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-3">
      <dt className="text-[11px] text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
