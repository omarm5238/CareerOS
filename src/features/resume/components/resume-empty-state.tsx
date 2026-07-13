import Link from "next/link";

import { ResumeReanalysisUpload } from "./resume-reanalysis-upload";

export function ResumeEmptyState() {
  return (
    <div className="relative mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
          Resume Module
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          No resume analysis yet
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
          Upload a resume to build your first CareerOS profile.
        </p>
      </div>

      <div className="mt-8 w-full">
        <ResumeReanalysisUpload />
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          href="/onboarding"
        >
          Or continue through onboarding
        </Link>
        <Link
          className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          href="/workspace"
        >
          Back to Workspace
        </Link>
      </div>
    </div>
  );
}
