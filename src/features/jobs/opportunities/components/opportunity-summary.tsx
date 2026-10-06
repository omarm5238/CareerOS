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
  provenance?: {
    state: "current" | "stale" | "missing";
    filename: string | null;
    revisionNumber: number | null;
    analyzedAt: string | null;
  } | null;
  evidenceRows?: Array<{ requirement: string; result: string; evidence: string; gap: string }>;
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
  provenance = null,
  evidenceRows = [],
}: OpportunitySummaryProps) {
  return (
    <section className="surface-glass p-5">
      <p className="section-eyebrow">Opportunity Intelligence</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Opportunity Score uses the same canonical match as Discovery. This is not hiring probability.
      </p>
      {provenance ? (
        <div className="mt-3 text-sm text-[var(--color-text-secondary)]" data-testid="opportunity-provenance">
          {provenance.state === "current" && provenance.filename ? (
            <p>
              Analyzed using {provenance.filename}
              {provenance.revisionNumber ? `, revision ${provenance.revisionNumber}` : ""}
              {provenance.analyzedAt ? ` on ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(provenance.analyzedAt))}` : ""}.
            </p>
          ) : (
            <p>Resume or job changed since this analysis. Re-run opportunity analysis.</p>
          )}
        </div>
      ) : null}
      {provenance && provenance.state !== "current" ? (
        <p className="mt-4 text-sm text-[var(--color-text-primary)]">
          The stored opportunity score is not current. Re-run analysis before treating any score, band, or eligibility as current.
        </p>
      ) : null}
      {provenance?.state === "current" && evidenceRows.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm" data-testid="opportunity-evidence">
          {evidenceRows.slice(0, 6).map((row) => (
            <li key={row.requirement}>
              <span className="text-[var(--color-text-primary)]">{row.requirement}</span>
              {" "}
              <span>{row.result}</span>
              {" — "}
              {row.evidence}
              {row.result === "MATCHED" ? null : `. ${row.gap}`}
            </li>
          ))}
        </ul>
      ) : null}
      {provenance?.state === "current" ? (
      <dl className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
        <div>{eligibilityStatus === "INELIGIBLE" ? "Opportunity Score Ineligible" : `Opportunity Score ${opportunityScore}`}</div>
        <div>Priority {PRIORITY_BAND_LABELS[priorityBand]}</div>
        <div>Evidence Coverage {evidenceCoverage}%</div>
        <div>Eligibility {eligibilityStatus.replaceAll("_", " ")}</div>
        <div>Application Effort {applicationEffort}</div>
      </dl>
      ) : null}
      {provenance?.state === "current" && topEvidence.length > 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-primary)]">Top evidence: {topEvidence.join(", ")}</p>
      ) : null}
      {provenance?.state === "current" && topGaps.length > 0 ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Top gaps: {topGaps.map((gap) => `${gap.requirementName} (${gap.severity})`).join(", ")}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {provenance?.state !== "current" || eligibilityStatus === "INELIGIBLE" ? null : packageId ? (
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
