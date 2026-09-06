import Link from "next/link";

import { PRIORITY_BAND_LABELS } from "../types";

type OpportunitySummaryProps = {
  jobPostingId: string;
  opportunityScore: number;
  priorityBand: keyof typeof PRIORITY_BAND_LABELS;
  evidenceCoverage: number;
  eligibilityStatus: string;
  applicationEffort: string;
  topEvidence: string[];
  topGaps: Array<{ requirementName: string; severity: string }>;
  packageId?: string | null;
};

export function OpportunitySummary({
  jobPostingId,
  opportunityScore,
  priorityBand,
  evidenceCoverage,
  eligibilityStatus,
  applicationEffort,
  topEvidence,
  topGaps,
  packageId,
}: OpportunitySummaryProps) {
  return (
    <section className="surface-glass p-5">
      <p className="section-eyebrow">Opportunity Intelligence</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Opportunity Score is separate from Discovery Suitability. This is not hiring probability.
      </p>
      <dl className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
        <div>Opportunity Score {opportunityScore}</div>
        <div>Priority {PRIORITY_BAND_LABELS[priorityBand]}</div>
        <div>Evidence Coverage {evidenceCoverage}%</div>
        <div>Eligibility {eligibilityStatus.replaceAll("_", " ")}</div>
        <div>Application Effort {applicationEffort}</div>
      </dl>
      {topEvidence.length > 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-primary)]">Top evidence: {topEvidence.join(", ")}</p>
      ) : null}
      {topGaps.length > 0 ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Top gaps: {topGaps.map((gap) => `${gap.requirementName} (${gap.severity})`).join(", ")}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {packageId ? (
          <Link className="btn-primary" href={`/workspace/jobs/apply-now/${packageId}`}>
            Review Package
          </Link>
        ) : (
          <Link className="btn-primary" href={`/workspace/jobs/apply-now`}>
            Prepare Application
          </Link>
        )}
        <form action={`/api/jobs/opportunities/${jobPostingId}/analyze`} method="post">
          <span className="sr-only">Analyze is available from Apply Now</span>
        </form>
      </div>
    </section>
  );
}
