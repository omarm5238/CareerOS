"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { JobAnalysisSource } from "../types";

type JobReanalyzeButtonProps = {
  jobId: string;
  analysisSource: JobAnalysisSource | null;
  hasResumeProfile: boolean;
};

export function JobReanalyzeButton({
  jobId,
  analysisSource,
  hasResumeProfile,
}: JobReanalyzeButtonProps) {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!hasResumeProfile) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Upload or analyze a resume first to improve job matching.
      </p>
    );
  }

  async function handleReanalyze() {
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/analyze`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Could not re-analyze this job.");
      }

      const body = (await response.json()) as {
        message?: string;
        preserved?: boolean;
        analysis?: { analysisSource?: JobAnalysisSource } | null;
      };

      if (body.preserved) {
        setSuccess(
          body.message ??
            (analysisSource === "ai"
              ? "AI was unavailable. Previous AI match preserved."
              : "AI was unavailable. Provisional match remains."),
        );
      } else if (body.analysis?.analysisSource === "rule_based") {
        setSuccess(
          body.message ?? "AI unavailable; provisional rule-based match saved.",
        );
      } else {
        setSuccess(body.message ?? "AI match updated.");
      }
      router.refresh();
      setIsAnalyzing(false);
    } catch (reanalyzeError) {
      if (process.env.NODE_ENV === "development") {
        console.error({
          taskName: "job-match-reanalyze",
          message:
            reanalyzeError instanceof Error ? reanalyzeError.message : "Re-analyze failed",
        });
      }

      setError("Could not re-analyze this job. Your current analysis is unchanged.");
      setIsAnalyzing(false);
    }
  }

  const label = analysisSource === "ai" ? "Re-analyze" : "Re-analyze with AI";

  return (
    <div>
      <button
        className="inline-flex surface-card px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isAnalyzing}
        onClick={() => void handleReanalyze()}
        type="button"
      >
        {isAnalyzing ? "Analyzing…" : label}
      </button>

      {error ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]" role="status">
          {success}
        </p>
      ) : null}
    </div>
  );
}
