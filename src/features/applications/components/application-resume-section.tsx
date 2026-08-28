"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApplicationResumeLink } from "../types";

export type ApplicationResumeOption = {
  versionId: string;
  versionTitle: string;
  versionStatus: string;
  revisionId: string;
  revisionNumber: number;
  alignmentScoreAfter: number | null;
};

type ApplicationResumeSectionProps = {
  applicationId: string;
  resume: ApplicationResumeLink;
  /** Only supplied while the application is still a draft. */
  options: ApplicationResumeOption[];
  canChange: boolean;
  hasJob: boolean;
};

export function ApplicationResumeSection({
  applicationId,
  resume,
  options,
  canChange,
  hasJob,
}: ApplicationResumeSectionProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(resume.resumeVersionRevisionId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save() {
    if (pending || !selected) return;

    const option = options.find((item) => item.revisionId === selected);
    if (!option) {
      setError("Choose a resume revision to link.");
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}/resume`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeVersionId: option.versionId,
            resumeVersionRevisionId: option.revisionId,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "That resume could not be linked.");
      }

      setSuccess(body?.message ?? "Resume link updated.");
      router.refresh();
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "That resume could not be linked.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface-glass p-5" id="resume-used">
      <p className="section-eyebrow">Resume Used</p>

      {resume.resumeVersionTitle ? (
        <>
          <h2 className="mt-2 text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
            {resume.resumeVersionTitle}
          </h2>

          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <MetaCell label="Revision" value={`Revision ${resume.revisionNumber ?? "?"}`} />
            <MetaCell
              label="ATS alignment"
              value={
                resume.alignmentScoreAfter === null
                  ? "Not scored"
                  : `${resume.alignmentScoreAfter}/100`
              }
            />
            <MetaCell label="Resume status" value={resume.resumeVersionStatus ?? "Unavailable"} />
          </dl>

          {resume.recordAvailable && resume.resumeVersionId ? (
            <p className="mt-3 text-sm">
              <Link
                className="text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                href={`/workspace/resume/versions/${resume.resumeVersionId}`}
              >
                Open resume version
              </Link>
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              The original CareerOS resume record is no longer available. The submission snapshot is
              preserved.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          No CareerOS resume revision recorded for this application.
        </p>
      )}

      {canChange ? (
        options.length > 0 ? (
          <div className="mt-5 border-t border-[var(--color-border-subtle)] pt-4">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                Change resume revision
              </span>
              <select
                className="input-field mt-1 w-full text-sm"
                onChange={(event) => setSelected(event.target.value)}
                value={selected}
              >
                <option value="">Select a revision…</option>
                {options.map((option) => (
                  <option key={option.revisionId} value={option.revisionId}>
                    {option.versionTitle} · Revision {option.revisionNumber}
                    {option.alignmentScoreAfter !== null
                      ? ` · ${option.alignmentScoreAfter}/100`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3">
              <button
                className="btn-secondary"
                disabled={pending || !selected || selected === resume.resumeVersionRevisionId}
                onClick={() => void save()}
                type="button"
              >
                {pending ? "Linking…" : "Link this revision"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
            {hasJob
              ? "No tailored resume version exists for this job yet. Create one from the Jobs module first."
              : "This application has no linked job, so no tailored resume versions can be suggested."}
          </p>
        )
      ) : (
        <p className="mt-4 font-mono-meta text-[var(--color-text-secondary)]">
          Resume locked after submission. It records exactly what was sent to this employer.
        </p>
      )}

      {error ? (
        <p className="mt-3 text-sm text-[var(--color-danger,#e5a3a3)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-3">
      <dt className="text-[11px] text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
