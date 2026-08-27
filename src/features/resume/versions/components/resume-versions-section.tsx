"use client";

import Link from "next/link";
import { useState } from "react";

import type { ResumeVersionListItem } from "../types";
import {
  formatResumeVersionDate,
  ResumeVersionStatusChip,
} from "./resume-version-badges";

type ResumeVersionsSectionProps = {
  versions: ResumeVersionListItem[];
  archivedVersions: ResumeVersionListItem[];
};

export function ResumeVersionsSection({
  versions,
  archivedVersions,
}: ResumeVersionsSectionProps) {
  const [showArchived, setShowArchived] = useState(false);
  const visible = showArchived ? [...versions, ...archivedVersions] : versions;

  return (
    <section className="surface-glass p-5" id="resume-versions">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow">Resume Versions</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
            Job-specific tailored resumes
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Tailored versions are created from a saved job. Your original uploaded resume is
            never overwritten.
          </p>
        </div>

        {archivedVersions.length > 0 ? (
          <button
            className="inline-flex surface-card px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            onClick={() => setShowArchived((current) => !current)}
            type="button"
          >
            {showArchived
              ? "Hide archived"
              : `Show archived (${archivedVersions.length})`}
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="mt-5 surface-card p-4">
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            No tailored resume versions yet. Open a saved job in the Jobs module and choose
            “Create tailored resume” to build one from your latest analyzed resume.
          </p>
          <Link
            className="mt-3 inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/workspace/jobs"
          >
            Go to Jobs module
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {visible.map((version) => (
            <li className="surface-card p-4" key={version.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                    {version.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {version.targetJobTitle
                      ? `${version.targetJobTitle}${
                          version.targetJobCompany ? ` · ${version.targetJobCompany}` : ""
                        }`
                      : "Target job no longer available"}
                  </p>
                </div>
                <ResumeVersionStatusChip status={version.status} />
              </div>

              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                <MetaCell
                  label="Estimated ATS alignment"
                  value={
                    version.alignmentScoreAfter === null
                      ? "Not scored"
                      : `${version.alignmentScoreAfter}/100`
                  }
                />
                <MetaCell
                  label="Active revision"
                  value={
                    version.activeRevisionNumber === null
                      ? "None"
                      : `Revision ${version.activeRevisionNumber}`
                  }
                />
                <MetaCell label="Updated" value={formatResumeVersionDate(version.updatedAt)} />
              </dl>

              <div className="mt-3">
                <Link
                  className="inline-flex surface-card px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  href={`/workspace/resume/versions/${version.id}`}
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-0.5 font-mono-meta text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
