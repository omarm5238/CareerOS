"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CareerBriefSource } from "../ai/types";

type GenerateCareerBriefButtonProps = {
  hasBrief: boolean;
  analysisSource: CareerBriefSource | null;
  targetJobId?: string | null;
};

export function GenerateCareerBriefButton({
  hasBrief,
  analysisSource,
  targetJobId,
}: GenerateCareerBriefButtonProps) {
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
      const response = await fetch("/api/analytics/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: targetJobId ?? null }),
      });

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        analysisSource?: CareerBriefSource;
        preserved?: boolean;
      } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "Could not generate CareerOS Brief.");
      }

      setSuccess(
        body?.preserved
          ? body.message ?? "AI refresh was unavailable. Previous AI Brief kept."
          : body?.analysisSource === "ai"
          ? "CareerOS Brief updated with AI."
          : "AI brief was unavailable. A provisional rule-based brief was saved.",
      );
      router.refresh();
      setIsGenerating(false);
    } catch (generateError) {
      if (process.env.NODE_ENV === "development") {
        console.error({
          taskName: "career-brief-generate",
          message:
            generateError instanceof Error ? generateError.message : "Generate failed",
        });
      }

      setError(
        generateError instanceof Error
          ? generateError.message
          : "Could not generate CareerOS Brief. Your current brief is unchanged.",
      );
      setIsGenerating(false);
    }
  }

  const label = hasBrief
    ? analysisSource === "ai"
      ? "Refresh Brief"
      : "Retry with AI"
    : "Generate Brief";

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
