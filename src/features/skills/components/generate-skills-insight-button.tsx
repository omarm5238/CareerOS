"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SkillsInsightSource } from "../types";

type GenerateSkillsInsightButtonProps = {
  hasInsight: boolean;
  analysisSource: SkillsInsightSource | null;
};

export function GenerateSkillsInsightButton({
  hasInsight,
  analysisSource,
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

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Could not generate skills strategy.");
      }

      setSuccess("Skills strategy updated.");
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
      ? "Refresh strategy"
      : "Refresh with AI"
    : "Generate AI strategy";

  return (
    <div>
      <button
        className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
