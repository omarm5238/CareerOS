import type { ReactNode } from "react";

type JobsEmptyStateProps = {
  children?: ReactNode;
};

export function JobsEmptyState({ children }: JobsEmptyStateProps) {
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--surface-glass)] p-6 text-center backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
        Jobs Module
      </p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
        No saved jobs yet
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        Add a job posting manually to generate your first resume match score.
      </p>
      {children ? <div className="mt-6 text-left">{children}</div> : null}
    </section>
  );
}
