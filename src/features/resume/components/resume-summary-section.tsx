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
      className="surface-glass p-5"
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
