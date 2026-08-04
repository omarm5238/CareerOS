import Link from "next/link";

import { ClearGeneratedInsightsButton } from "./clear-generated-insights-button";
import { ExportWorkspaceDataButton } from "./export-workspace-data-button";

export function DataControlsPanel() {
  return (
    <section
      aria-labelledby="data-controls-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="data-controls-heading"
      >
        Data Controls
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        Export your CareerOS workspace data or clear generated AI insights. These actions do not
        delete your account.
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Human report</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Open a print-friendly CareerOS report you can save as PDF from the browser.
          </p>
          <div className="mt-3">
            <Link
              className="inline-flex surface-card px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/workspace/report"
            >
              Open Report
            </Link>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Export</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Download a JSON export of profile, resumes, jobs, skills insights, career briefs, and
            refined report fields.
          </p>
          <div className="mt-3">
            <ExportWorkspaceDataButton />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            Clear generated insights
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Deletes AI-generated skills strategies and career briefs. Resume and jobs remain.
          </p>
          <div className="mt-3">
            <ClearGeneratedInsightsButton />
          </div>
        </div>
      </div>
    </section>
  );
}
