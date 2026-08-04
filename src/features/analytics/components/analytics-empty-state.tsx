import Link from "next/link";

export function AnalyticsEmptyState() {
  return (
    <div className="relative mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
          Analytics Module
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          No career data yet
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
          Upload a resume and add saved jobs to unlock career readiness analytics.
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          className="btn-primary"
          href="/onboarding"
        >
          Upload resume
        </Link>
        <Link
          className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--surface-glass)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          href="/workspace/jobs"
        >
          Add job
        </Link>
      </div>

      <Link
        className="mt-6 text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        href="/workspace"
      >
        Back to Workspace
      </Link>
    </div>
  );
}
