"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { OpportunitySummary } from "./opportunity-summary";
import { PRIORITY_BAND_LABELS } from "../types";
import type { OpportunityPriorityBand } from "@/generated/prisma/client";

type JobOpportunityEntryProps = {
  jobPostingId: string;
  analysis: {
    opportunityScore: number;
    priorityBand: OpportunityPriorityBand;
    evidenceCoverage: number;
    eligibilityStatus: string;
    applicationEffort: string;
    topEvidence: string[];
    topGaps: Array<{ requirementName: string; severity: string }>;
  } | null;
  packageId: string | null;
};

export function JobOpportunityEntry({ jobPostingId, analysis, packageId }: JobOpportunityEntryProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, then?: (json: Record<string, unknown>) => void) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        setError(typeof json.message === "string" ? json.message : "Request failed.");
        return;
      }
      then?.(json);
      router.refresh();
    } catch {
      setError("Request failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {analysis ? (
        <OpportunitySummary
          jobPostingId={jobPostingId}
          opportunityScore={analysis.opportunityScore}
          priorityBand={analysis.priorityBand}
          evidenceCoverage={analysis.evidenceCoverage}
          eligibilityStatus={analysis.eligibilityStatus}
          applicationEffort={analysis.applicationEffort}
          topEvidence={analysis.topEvidence}
          topGaps={analysis.topGaps}
          packageId={packageId}
        />
      ) : (
        <section className="surface-glass p-5">
          <p className="section-eyebrow">Opportunity Intelligence</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Analyze this job for requirements, evidence, eligibility, and priority. This is not Discovery Suitability or hiring probability.
          </p>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-secondary"
          data-testid="analyze-opportunity"
          disabled={pending}
          onClick={() => void run(`/api/jobs/opportunities/${jobPostingId}/analyze`)}
          type="button"
        >
          {pending ? "Working…" : "Analyze Opportunity"}
        </button>
        <button
          className="btn-primary"
          data-testid="prepare-application"
          disabled={pending}
          onClick={() =>
            void run(`/api/jobs/opportunities/${jobPostingId}/prepare`, (json) => {
              if (typeof json.packageId === "string") {
                router.push(`/workspace/jobs/apply-now/${json.packageId}`);
              }
            })
          }
          type="button"
        >
          Prepare Application
        </button>
      </div>
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      <p className="sr-only">{PRIORITY_BAND_LABELS.REVIEW_FIRST}</p>
    </div>
  );
}
