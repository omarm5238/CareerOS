import Link from "next/link";

import { JobTailoredResumeSection } from "@/features/resume/versions/components/job-tailored-resume-section";
import type { JobTailoredResumeSummary } from "@/features/resume/versions/types";
import { JobApplicationSection } from "@/features/applications/components/job-application-section";
import type { JobApplicationSummary } from "@/features/applications/server";

import type { JobDetailView } from "../types";
import { JobAiInsights } from "./job-ai-insights";
import { JobAnalysisSourceBadge } from "./job-analysis-source-badge";
import { DeleteJobButton } from "./delete-job-button";
import { formatJobCreatedAt, JobMatchSummary } from "./job-match-summary";
import { JobRecommendations } from "./job-recommendations";
import { JobReanalyzeButton } from "./job-reanalyze-button";

type JobDetailPanelProps = {
  job: JobDetailView;
  hasResumeProfile: boolean;
  tailoredResume: JobTailoredResumeSummary | null;
  applicationSummary: JobApplicationSummary;
};

export function JobDetailPanel({
  job,
  hasResumeProfile,
  tailoredResume,
  applicationSummary,
}: JobDetailPanelProps) {
  const preview =
    job.description.length > 420
      ? `${job.description.slice(0, 420).trimEnd()}…`
      : job.description;

  return (
    <div className="space-y-4">
      <section className="surface-glass p-5">
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

      <JobTailoredResumeSection
        hasResumeProfile={hasResumeProfile}
        jobId={job.id}
        summary={tailoredResume ?? { primary: null, archivedCount: 0 }}
      />

      <JobApplicationSection jobId={job.id} summary={applicationSummary} />

      {job.analysis ? (
        <>
          <section className="surface-glass p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <JobAnalysisSourceBadge source={job.analysis.analysisSource} />
              <JobReanalyzeButton
                analysisSource={job.analysis.analysisSource}
                hasResumeProfile={hasResumeProfile}
                jobId={job.id}
              />
            </div>
          </section>

          <JobMatchSummary
            matchScore={job.analysis.matchScore}
            matchedSkills={job.analysis.matchedSkills}
            missingSkills={job.analysis.missingSkills}
            roleAlignment={job.analysis.roleAlignment}
          />

          {job.analysis.analysisSource === "ai" ? (
            <JobAiInsights analysis={job.analysis} />
          ) : null}

          <JobRecommendations recommendations={job.analysis.recommendations} />

          {job.analysis.aiWarnings.length > 0 ? (
            <section className="surface-glass p-5">
              <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                Analysis notes
              </h2>
              <ul className="mt-3 space-y-2">
                {job.analysis.aiWarnings.map((warning) => (
                  <li
                    className="text-sm leading-6 text-[var(--color-text-secondary)]"
                    key={warning}
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No match analysis is available for this job.
        </p>
      )}

      <section className="surface-glass p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
          Danger zone
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Remove this saved job and its analysis only.
        </p>
        <div className="mt-3">
          <DeleteJobButton jobId={job.id} />
        </div>
      </section>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-3">
      <dt className="text-[11px] text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}

