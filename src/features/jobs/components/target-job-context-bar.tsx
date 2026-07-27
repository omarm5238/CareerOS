import Link from "next/link";

import type { TargetJobContext } from "../types/target-job-context";
import { shortJobDisplayTitle } from "@/features/skills/lib/build-selected-job-project-ideas";

export function TargetJobContextBar({
  context,
  basePath,
  allJobsMode = false,
}: {
  context: TargetJobContext;
  basePath: "/workspace/skills" | "/workspace/analytics" | "/workspace/report";
  allJobsMode?: boolean;
}) {
  if (!context.hasJobs || !context.selectedJob) return null;

  const selectedShort = shortJobDisplayTitle(context.selectedJob.title);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            {allJobsMode ? "Scope" : "Target job"}
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
            {allJobsMode
              ? "All saved jobs"
              : `${selectedShort ?? context.selectedJob.title} · ${context.selectedJob.company}`}
          </p>
        </div>
        {!allJobsMode ? (
          <Link
            className="text-sm text-[var(--color-accent)] underline-offset-4 hover:underline"
            href={`/workspace/jobs?jobId=${encodeURIComponent(context.selectedJob.id)}`}
            scroll
          >
            View job
          </Link>
        ) : null}
      </div>
      {context.availableJobs.length > 1 ? (
        <nav aria-label="Switch target job" className="mt-3 flex flex-wrap gap-2">
          <Link
            aria-current={allJobsMode ? "page" : undefined}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              allJobsMode
                ? "border-[rgb(99_102_241_/_45%)] bg-[rgb(99_102_241_/_12%)] text-[var(--color-accent)]"
                : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
            href={basePath}
            scroll
          >
            All saved jobs
          </Link>
          {context.availableJobs.map((job) => {
            const short = shortJobDisplayTitle(job.title) ?? job.title;
            return (
              <Link
                aria-current={
                  !allJobsMode && job.id === context.selectedJobId ? "page" : undefined
                }
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  !allJobsMode && job.id === context.selectedJobId
                    ? "border-[rgb(99_102_241_/_45%)] bg-[rgb(99_102_241_/_12%)] text-[var(--color-accent)]"
                    : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
                href={`${basePath}?jobId=${encodeURIComponent(job.id)}`}
                key={job.id}
                scroll
                title={`${job.title} · ${job.company}`}
              >
                {short} · {job.company}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}
