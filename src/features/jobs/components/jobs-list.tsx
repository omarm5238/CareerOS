import Link from "next/link";

import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/features/jobs/constants/application-status";
import type { JobListItem } from "../types";
import { JobAnalysisSourceBadge } from "./job-analysis-source-badge";

type JobsListProps = {
  jobs: JobListItem[];
  selectedJobId: string | null;
};

const APPLICATION_STATUS_CHIP: Record<ApplicationStatus, string> = {
  saved: "status-chip status-chip--neutral",
  applied: "status-chip status-chip--info",
  interview: "status-chip status-chip--warning",
  offer: "status-chip status-chip--success",
  rejected: "status-chip status-chip--danger",
};

export function JobsList({ jobs, selectedJobId }: JobsListProps) {
  if (jobs.length === 0) return null;

  return (
    <section
      aria-labelledby="jobs-list-heading"
      className="surface-glass p-5"
    >
      <h2 className="section-eyebrow" id="jobs-list-heading">
        Saved Jobs
      </h2>
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
        Latest {jobs.length} saved postings.
      </p>

      <ul className="mt-4 space-y-2">
        {jobs.map((job) => {
          const isSelected = job.id === selectedJobId;
          return (
            <li key={job.id}>
              <Link
                aria-current={isSelected ? "page" : undefined}
                className={`block rounded-[var(--radius-md)] border px-3 py-3 [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  isSelected
                    ? "selected-row"
                    : "border-[var(--color-border-subtle)] bg-[var(--surface-inset)] hover:border-[var(--color-border)]"
                }`}
                href={`/workspace/jobs?jobId=${encodeURIComponent(job.id)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-[var(--color-text-primary)]">
                      {job.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={APPLICATION_STATUS_CHIP[job.applicationStatus]}>
                      {APPLICATION_STATUS_LABELS[job.applicationStatus]}
                    </span>
                    {job.analysis ? (
                      <>
                        <JobAnalysisSourceBadge
                          className="px-2 py-0.5 text-[10px]"
                          source={job.analysis.analysisSource}
                        />
                        <span className="metric-number rounded-full border border-[var(--color-border-subtle)] bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] text-[var(--color-text-primary)]">
                          {job.analysis.matchScore}%
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </Link>
              <div className="mt-1 flex flex-wrap gap-3 px-2 text-xs">
                <Link
                  className="text-[var(--color-accent)] underline-offset-4 hover:underline"
                  href={`/workspace/skills?jobId=${encodeURIComponent(job.id)}`}
                >
                  Analyze in Skills
                </Link>
                <Link
                  className="text-[var(--color-accent)] underline-offset-4 hover:underline"
                  href={`/workspace/analytics?jobId=${encodeURIComponent(job.id)}`}
                >
                  View Analytics
                </Link>
                <Link
                  className="text-[var(--color-accent)] underline-offset-4 hover:underline"
                  href={`/workspace/report?jobId=${encodeURIComponent(job.id)}`}
                >
                  View Report
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
