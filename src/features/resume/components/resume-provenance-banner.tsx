import type { ActiveResumeRevision } from "../provenance";

type ResumeProvenanceBannerProps = {
  active: ActiveResumeRevision | null;
  analysisCreatedAt: string | null;
  mode: "current" | "outdated" | "historical" | "legacy";
};

function formatDate(value: Date | string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function ResumeProvenanceBanner({ active, analysisCreatedAt, mode }: ResumeProvenanceBannerProps) {
  if (mode === "legacy") {
    return (
      <section className="surface-glass mb-6 p-5" data-testid="resume-provenance">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Fresh resume analysis required</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Older analyses stay in history. They are not the current resume until you analyze a full source CV again.
        </p>
      </section>
    );
  }

  return (
    <section className="surface-glass mb-6 p-5" data-testid="resume-provenance">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Active resume</p>
      {active ? (
        <dl className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
          <div>Source file {active.sourceFilename}</div>
          <div data-testid="resume-revision-number">Revision {active.revisionNumber}</div>
          <div>Uploaded {formatDate(active.uploadedAt)}</div>
          <div>Activated {formatDate(active.activatedAt)}</div>
          <div>Analyzed {formatDate(analysisCreatedAt)}</div>
          <div data-testid="resume-truth-status">
            {mode === "current" ? "Current analysis" : mode === "outdated" ? "Outdated analysis" : "Historical analysis"}
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No active source resume is selected.</p>
      )}
      {mode === "outdated" ? (
        <p className="mt-3 text-sm text-[var(--color-text-primary)]">
          Outdated analysis. Reanalysis required. The resume changed since this analysis, so these recommendations are historical.
        </p>
      ) : null}
      {mode === "historical" ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          This analysis is historical. Current recommendations come only from the active resume.
        </p>
      ) : null}
    </section>
  );
}
