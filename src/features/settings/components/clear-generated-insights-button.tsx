"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClearGeneratedInsightsButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleClear() {
    if (isClearing) return;

    setIsClearing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/generated-insights", {
        method: "DELETE",
      });

      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
        skillsInsightsDeleted?: number;
        careerBriefsDeleted?: number;
      };

      if (!response.ok) {
        throw new Error(body?.message ?? "Could not clear generated insights.");
      }

      setSuccess(
        `Deleted ${body.skillsInsightsDeleted ?? 0} skills insight(s) and ${body.careerBriefsDeleted ?? 0} career brief(s).`,
      );
      setConfirming(false);
      setIsClearing(false);
      router.refresh();
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Could not clear generated insights.",
      );
      setIsClearing(false);
      setConfirming(false);
    }
  }

  return (
    <div>
      {!confirming ? (
        <button
          className="inline-flex rounded-[var(--radius-md)] border border-[rgb(239_68_68_/_35%)] bg-[rgb(239_68_68_/_10%)] px-4 py-2 text-sm font-medium text-[rgb(252_165_165)] [transition:var(--motion-fade)] hover:border-[rgb(239_68_68_/_50%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          onClick={() => {
            setError(null);
            setSuccess(null);
            setConfirming(true);
          }}
          type="button"
        >
          Clear generated insights
        </button>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[rgb(239_68_68_/_25%)] bg-[rgb(239_68_68_/_8%)] p-4">
          <p className="text-sm text-[var(--color-text-primary)]">
            Deletes AI-generated skills strategies and career briefs. Resume and jobs remain.
            This cannot be undone. This does not delete your account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex rounded-[var(--radius-md)] border border-[rgb(239_68_68_/_40%)] bg-[rgb(239_68_68_/_15%)] px-3 py-1.5 text-sm text-[rgb(252_165_165)] disabled:opacity-50"
              disabled={isClearing}
              onClick={() => void handleClear()}
              type="button"
            >
              {isClearing ? "Clearing…" : "Confirm clear"}
            </button>
            <button
              className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] disabled:opacity-50"
              disabled={isClearing}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
