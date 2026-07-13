import Link from "next/link";

import type { JobListItem } from "../types";

type JobsListProps = {
  jobs: JobListItem[];
  selectedJobId: string | null;
};

export function JobsList({ jobs, selectedJobId }: JobsListProps) {
  if (jobs.length === 0) return null;

  return (
    <section
      aria-labelledby="jobs-list-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="jobs-list-heading"
      >
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
                    ? "border-[rgb(99_102_241_/_40%)] bg-[rgb(99_102_241_/_10%)]"
                    : "border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] hover:border-[var(--color-border)]"
                }`}
                href={`/workspace/jobs?jobId=${encodeURIComponent(job.id)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {job.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  {job.analysis ? (
                    <span className="rounded-full border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_70%)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                      {job.analysis.matchScore}% match
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
