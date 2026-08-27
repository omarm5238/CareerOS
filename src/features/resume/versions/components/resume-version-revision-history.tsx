"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ResumeVersionRevisionSummary } from "../types";
import {
  formatResumeVersionDate,
  resumeVersionModelLabel,
  resumeVersionSourceLabel,
} from "./resume-version-badges";

type ResumeVersionRevisionHistoryProps = {
  versionId: string;
  revisions: ResumeVersionRevisionSummary[];
  activeRevisionId: string | null;
};

export function ResumeVersionRevisionHistory({
  versionId,
  revisions,
  activeRevisionId,
}: ResumeVersionRevisionHistoryProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSetActive(revisionId: string) {
    if (pendingId) return;

    setPendingId(revisionId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/resume/versions/${encodeURIComponent(versionId)}/active-revision`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revisionId }),
        },
      );

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "Could not change the active revision.");
      }

      setSuccess(body?.message ?? "Active revision updated.");
      router.refresh();
      setPendingId(null);
    } catch (activeError) {
      if (process.env.NODE_ENV === "development") {
        console.error({
          taskName: "resume-version-set-active-revision",
          message:
            activeError instanceof Error ? activeError.message : "Set active failed",
        });
      }

      setError("Could not change the active revision. Nothing was deleted.");
      setPendingId(null);
    }
  }

  return (
    <section className="surface-glass p-5 no-print" id="revision-history">
      <p className="section-eyebrow">Revision History</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
        Every generation and edit is kept
      </h2>

      {revisions.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No revisions recorded yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {revisions.map((revision) => {
            const isActive = revision.id === activeRevisionId;
            const modelLabel = resumeVersionModelLabel(revision.source, revision.model);

            return (
              <li
                className={`surface-card p-3 ${isActive ? "selected-row" : ""}`}
                key={revision.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Revision {revision.revisionNumber}
                    {isActive ? " · Active" : ""}
                  </p>
                  <span className="status-chip status-chip--mono">
                    {revision.generationStatus}
                  </span>
                </div>

                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {resumeVersionSourceLabel(revision.source)}
                  {modelLabel ? ` · ${modelLabel}` : ""} ·{" "}
                  {formatResumeVersionDate(revision.createdAt)}
                </p>

                {!isActive ? (
                  <button
                    className="mt-2 inline-flex surface-card px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pendingId !== null}
                    onClick={() => void handleSetActive(revision.id)}
                    type="button"
                  >
                    {pendingId === revision.id ? "Switching…" : "Set as active"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-[var(--color-accent)]" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
