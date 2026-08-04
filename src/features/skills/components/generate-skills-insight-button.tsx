"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SkillsInsightSource } from "../types";

type GenerateSkillsInsightButtonProps = {
  hasInsight: boolean;
  analysisSource: SkillsInsightSource | null;
  allJobsLabel?: boolean;
};

export function GenerateSkillsInsightButton({
  hasInsight,
  analysisSource,
  allJobsLabel = false,
}: GenerateSkillsInsightButtonProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleGenerate() {
    if (isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/skills/analyze", {
        method: "POST",
      });

      const body = (await response.json().catch(() => null)) as
        | {
            message?: string;
            skipped?: boolean;
            preserved?: boolean;
            warnings?: string[];
            prioritySkills?: unknown[];
            analysisSource?: SkillsInsightSource;
          }
        | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "Could not generate skills strategy.");
      }

      if (body?.skipped) {
        setSuccess(
          body.message ??
            "Add a saved job before generating a market-driven skills strategy.",
        );
        router.refresh();
        setIsGenerating(false);
        return;
      }

      if (body?.preserved) {
        setSuccess(
          body.message ?? "AI refresh failed. Previous AI skills strategy kept.",
        );
        router.refresh();
        setIsGenerating(false);
        return;
      }

      const warning = body?.warnings?.[0];
      const emptyPriorities = (body?.prioritySkills?.length ?? 0) === 0;
      setSuccess(
        body?.message ??
          (body?.analysisSource === "ai"
            ? "Skills strategy updated with AI."
            : emptyPriorities && warning
              ? warning
              : "AI strategy was unavailable. A provisional rule-based strategy was saved."),
      );
      router.refresh();
      setIsGenerating(false);
    } catch (generateError) {
      if (process.env.NODE_ENV === "development") {
        console.error({
          taskName: "skills-insight-generate",
          message:
            generateError instanceof Error ? generateError.message : "Generate failed",
        });
      }

      setError(
        generateError instanceof Error
          ? generateError.message
          : "Could not generate skills strategy. Your current insight is unchanged.",
      );
      setIsGenerating(false);
    }
  }

  const label = hasInsight
    ? analysisSource === "ai"
      ? allJobsLabel
        ? "Refresh all-jobs strategy"
        : "Refresh strategy"
      : allJobsLabel
        ? "Refresh all-jobs with AI"
        : "Refresh with AI"
    : allJobsLabel
      ? "Generate all-jobs AI strategy"
      : "Generate AI strategy";

  return (
    <div>
      <button
        className="inline-flex surface-card px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isGenerating}
        onClick={() => void handleGenerate()}
        type="button"
      >
        {isGenerating ? "Generating…" : label}
      </button>

      {error ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-2 text-sm text-[var(--color-accent)]" role="status">
          {success}
        </p>
      ) : null}
    </div>
  );
}
