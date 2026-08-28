import Link from "next/link";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import type { JobTailoredResumeSummary } from "@/features/resume/versions/types";
import type { JobApplicationSummary } from "@/features/applications/server";

import type { JobDetailView, JobListItem } from "../types";
import { AddJobForm } from "./add-job-form";
import { JobDetailPanel } from "./job-detail-panel";
import { JobsEmptyState } from "./jobs-empty-state";
import { JobsList } from "./jobs-list";

type JobsModulePageProps = {
  jobs: JobListItem[];
  selectedJob: JobDetailView | null;
  selectedJobId: string | null;
  jobNotFound?: boolean;
  hasResumeProfile: boolean;
  tailoredResume: JobTailoredResumeSummary | null;
  applicationSummary: JobApplicationSummary | null;
};

export function JobsModulePage({
  jobs,
  selectedJob,
  selectedJobId,
  jobNotFound = false,
  hasResumeProfile,
  tailoredResume,
  applicationSummary,
}: JobsModulePageProps) {
  return (
    <WorkspaceModuleLayout title="Jobs Module">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 opacity-[0.14]">
          <CareerCore
            animated={false}
            className="h-full w-full"
            density="low"
            interactive={false}
            mode="workspace"
            pulse={false}
          />
        </div>

        <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
          <header className="space-y-3">
            <Link
              className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/workspace"
            >
              Back to Workspace
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
                Jobs Module
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                Job Matching
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Save job postings and compare them against your latest resume profile with AI
                matching and rule-based fallback.
              </p>
            </div>
          </header>

          {jobNotFound ? (
            <section className="mt-6 surface-glass p-5">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Job not found
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                That job could not be found, or it does not belong to your account.
              </p>
              <Link
                className="mt-4 inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                href="/workspace/jobs"
              >
                View latest jobs
              </Link>
            </section>
          ) : null}

          {jobs.length === 0 ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <AddJobForm hasResumeProfile={hasResumeProfile} />
              <JobsEmptyState />
            </div>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-6">
                <AddJobForm hasResumeProfile={hasResumeProfile} />
                <JobsList jobs={jobs} selectedJobId={selectedJobId} />
              </div>
              <div>
                {selectedJob ? (
                  <JobDetailPanel
                    applicationSummary={
                      applicationSummary ?? { current: null, lastClosed: null, totalAttempts: 0 }
                    }
                    hasResumeProfile={hasResumeProfile}
                    job={selectedJob}
                    tailoredResume={tailoredResume}
                  />
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Select a saved job to view match details.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
