import Link from "next/link";

import type { JobTailoredResumeSummary } from "../types";
import { CreateTailoredResumeButton } from "./create-tailored-resume-button";
import {
  formatResumeVersionDate,
  ResumeVersionStatusChip,
} from "./resume-version-badges";

type JobTailoredResumeSectionProps = {
  jobId: string;
  hasResumeProfile: boolean;
  summary: JobTailoredResumeSummary;
};

export function JobTailoredResumeSection({
  jobId,
  hasResumeProfile,
  summary,
}: JobTailoredResumeSectionProps) {
  const primary = summary.primary;

  return (
    <section className="surface-glass p-5">
      <p className="section-eyebrow">Tailored Resume</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        {primary
          ? headingForStatus(primary.status)
          : summary.archivedCount > 0
          ? "Previous tailored resumes archived"
          : "No tailored resume yet"}
      </h2>

      {!hasResumeProfile ? (
        <div className="mt-3">
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            Upload and analyze a resume before creating a job-specific version.
          </p>
          <Link
            className="mt-3 inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/workspace/resume"
          >
            Go to Resume module
          </Link>
        </div>
      ) : primary ? (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <ResumeVersionStatusChip status={primary.status} />
            {primary.activeRevisionNumber !== null ? (
              <span className="status-chip status-chip--mono">
                Revision {primary.activeRevisionNumber}
              </span>
            ) : null}
            {primary.alignmentScoreAfter !== null ? (
              <span className="status-chip status-chip--mono">
                Alignment {primary.alignmentScoreAfter}/100
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            {primary.title} · Updated {formatResumeVersionDate(primary.updatedAt)}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex surface-card px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href={`/workspace/resume/versions/${primary.id}`}
            >
              Open tailored resume
            </Link>
            <CreateTailoredResumeButton jobId={jobId} label="Create another version" />
          </div>

          {summary.archivedCount > 0 ? (
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              {summary.archivedCount} archived version
              {summary.archivedCount === 1 ? "" : "s"} for this job are kept but hidden.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            {summary.archivedCount > 0
              ? "Previous tailored resumes for this job are archived. Create a new version to apply with a focused resume."
              : "Create a version of your resume focused on this job. Your original resume is never overwritten, and missing requirements are reported instead of invented."}
          </p>

          <div className="mt-4">
            <CreateTailoredResumeButton
              jobId={jobId}
              label={
                summary.archivedCount > 0 ? "Create new version" : "Create tailored resume"
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}

function headingForStatus(status: string): string {
  if (status === "READY") return "Ready tailored resume";
  if (status === "USED") return "Tailored resume used for this job";
  return "Draft tailored resume exists";
}
