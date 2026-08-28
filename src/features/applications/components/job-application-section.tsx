import Link from "next/link";

import type { JobApplicationSummary } from "@/features/applications/server";
import { APPLICATION_STATUS_LABELS } from "@/features/applications/lib/application-state";

import { formatApplicationDate, formatApplicationDateTime } from "./application-badges";
import { StartApplicationButton } from "./start-application-button";

type JobApplicationSectionProps = {
  jobId: string;
  summary: JobApplicationSummary;
};

export function JobApplicationSection({ jobId, summary }: JobApplicationSectionProps) {
  const { current, lastClosed, totalAttempts } = summary;

  return (
    <section className="surface-glass p-5" id="job-application">
      <p className="section-eyebrow">Application</p>
      <JobApplicationBody
        current={current}
        jobId={jobId}
        lastClosed={lastClosed}
        totalAttempts={totalAttempts}
      />
    </section>
  );
}

function JobApplicationBody({
  jobId,
  current,
  lastClosed,
  totalAttempts,
}: {
  jobId: string;
  current: JobApplicationSummary["current"];
  lastClosed: JobApplicationSummary["lastClosed"];
  totalAttempts: number;
}) {
  if (!current && !lastClosed) {
    return (
      <>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
          No application yet
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Start tracking this job as a first-class application. The original job posting stays
          unchanged.
        </p>
        <div className="mt-4">
          <StartApplicationButton jobId={jobId} />
        </div>
      </>
    );
  }

  if (!current && lastClosed) {
    return (
      <>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
          Previous attempt: {APPLICATION_STATUS_LABELS[lastClosed.status]}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Closed {formatApplicationDate(lastClosed.closedAt)}. That history is preserved.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="btn-secondary"
            href={`/workspace/applications/${lastClosed.id}`}
          >
            Open review
          </Link>
          <StartApplicationButton jobId={jobId} label="Start new application attempt" />
        </div>
      </>
    );
  }

  if (!current) return null;

  if (current.status === "DRAFT") {
    return (
      <>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
          Application in preparation
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          {current.resumeVersionTitle
            ? `${current.resumeVersionTitle} · Revision ${current.revisionNumber ?? "?"}`
            : "No CareerOS resume revision linked yet."}
        </p>
        <div className="mt-4">
          <Link className="btn-primary" href={`/workspace/applications/${current.id}`}>
            Continue application
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        {APPLICATION_STATUS_LABELS[current.status]}
      </h2>
      {current.nextActionTitle ? (
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-primary)]">
          Next: {current.nextActionTitle}
        </p>
      ) : null}
      {current.upcomingEventTitle ? (
        <p className="mt-1 font-mono-meta text-[var(--color-accent)]">
          {current.upcomingEventTitle}
          {current.upcomingEventAt
            ? ` · ${formatApplicationDateTime(current.upcomingEventAt)}`
            : ""}
        </p>
      ) : null}
      {current.followUpAt ? (
        <p className="mt-1 font-mono-meta text-[var(--color-text-secondary)]">
          Follow-up {formatApplicationDateTime(current.followUpAt)}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {totalAttempts > 1 ? `${totalAttempts} attempts recorded. ` : ""}
        {current.resumeVersionTitle
          ? `${current.resumeVersionTitle} · Revision ${current.revisionNumber ?? "?"}`
          : "No CareerOS resume revision recorded."}
      </p>
      <div className="mt-4">
        <Link className="btn-primary" href={`/workspace/applications/${current.id}`}>
          Open application
        </Link>
      </div>
    </>
  );
}
