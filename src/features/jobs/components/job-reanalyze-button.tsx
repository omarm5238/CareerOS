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

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/analyze`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Could not re-analyze this job.");
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
        className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
}
