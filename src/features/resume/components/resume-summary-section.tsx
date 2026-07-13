import { buildResumeSummaryFallback } from "../lib/format-resume-display";
import type { ResumeModuleAnalysis } from "../types";

type ResumeSummarySectionProps = {
  analysis: ResumeModuleAnalysis;
};

export function ResumeSummarySection({ analysis }: ResumeSummarySectionProps) {
  const summary =
    analysis.profileSummary?.trim() ||
    buildResumeSummaryFallback({
      role: analysis.role,
      experienceLevel: analysis.experienceLevel,
      completenessScore: analysis.completenessScore,
    });

  return (
    <section
      aria-labelledby="resume-summary-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-summary-heading"
      >
        Profile Summary
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--color-text-primary)]">{summary}</p>
    </section>
  );
}
