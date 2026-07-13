import Link from "next/link";

import type { ResumeModuleAnalysis } from "../types";
import { AnalysisSourceBadge } from "./analysis-source-badge";

type ResumeAnalysisHeaderProps = {
  analysis: ResumeModuleAnalysis;
};

export function ResumeAnalysisHeader({ analysis }: ResumeAnalysisHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          href="/workspace"
        >
          Back to Workspace
        </Link>
        <Link
          className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          href="/workspace/resume"
        >
          Latest analysis
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
            Resume Module
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Resume Analysis
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Source file:{" "}
            <span className="text-[var(--color-text-primary)]">{analysis.filename}</span>
          </p>
        </div>

        <AnalysisSourceBadge source={analysis.analysisSource} />
      </div>
    </header>
  );
}
