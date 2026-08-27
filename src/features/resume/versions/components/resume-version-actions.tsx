"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ResumeVersionActionsProps = {
  versionId: string;
  status: string;
  hasActiveRevision: boolean;
  canRegenerate: boolean;
};

type PendingAction = "regenerate" | "ready" | "draft" | "archive" | null;

export function ResumeVersionActions({
  versionId,
  status,
  hasActiveRevision,
  canRegenerate,
}: ResumeVersionActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run(action: Exclude<PendingAction, null>) {
    if (pending) return;

    if (action === "archive") {
      const confirmed = window.confirm(
        "Archive this tailored resume version? It stays in your account but is hidden from default lists.",
      );
      if (!confirmed) return;
    }

    setPending(action);
    setError(null);
    setSuccess(null);

    try {
      const response =
        action === "regenerate"
          ? await fetch(
              `/api/resume/versions/${encodeURIComponent(versionId)}/regenerate`,
              { method: "POST" },
            )
          : await fetch(`/api/resume/versions/${encodeURIComponent(versionId)}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status:
                  action === "ready" ? "READY" : action === "archive" ? "ARCHIVED" : "DRAFT",
              }),
            });

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "That action could not be completed.");
      }

      setSuccess(body?.message ?? "Done.");
      router.refresh();
      setPending(null);
    } catch (actionError) {
      if (process.env.NODE_ENV === "development") {
        console.error({
          taskName: `resume-version-${action}`,
          message: actionError instanceof Error ? actionError.message : "Action failed",
        });
      }

      setError(
        actionError instanceof Error
          ? actionError.message
          : "That action could not be completed. Nothing was changed.",
      );
      setPending(null);
    }
  }

  return (
    <section className="surface-glass p-5 no-print" id="version-actions">
      <p className="section-eyebrow">Actions</p>

      <div className="mt-4 flex flex-wrap gap-3">
        {status !== "READY" && status !== "ARCHIVED" ? (
          <button
            className="btn-primary"
            disabled={pending !== null || !hasActiveRevision}
            onClick={() => void run("ready")}
            type="button"
          >
            {pending === "ready" ? "Updating…" : "Mark as Ready"}
          </button>
        ) : null}

        {status === "READY" ? (
          <button
            className="btn-secondary"
            disabled={pending !== null}
            onClick={() => void run("draft")}
            type="button"
          >
            {pending === "draft" ? "Updating…" : "Move back to Draft"}
          </button>
        ) : null}

        {status === "ARCHIVED" ? (
          <button
            className="btn-secondary"
            disabled={pending !== null}
            onClick={() => void run("draft")}
            type="button"
          >
            {pending === "draft" ? "Restoring…" : "Restore to Draft"}
          </button>
        ) : null}

        {canRegenerate && status !== "ARCHIVED" ? (
          <button
            className="btn-secondary"
            disabled={pending !== null}
            onClick={() => void run("regenerate")}
            type="button"
          >
            {pending === "regenerate" ? "Regenerating…" : "Regenerate"}
          </button>
        ) : null}

        <button
          className="btn-secondary"
          disabled={pending !== null}
          onClick={() => window.print()}
          type="button"
        >
          Print / Save as PDF
        </button>

        {status !== "ARCHIVED" ? (
          <button
            className="btn-danger"
            disabled={pending !== null}
            onClick={() => void run("archive")}
            type="button"
          >
            {pending === "archive" ? "Archiving…" : "Archive"}
          </button>
        ) : null}
      </div>

      {!hasActiveRevision ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          This version has no active revision yet, so it cannot be marked ready.
        </p>
      ) : null}

      {!canRegenerate ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          The target job for this version is no longer saved, so it cannot be regenerated.
          Existing revisions are unaffected.
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-[var(--color-text-secondary)]">
        Regenerating adds a new revision. Nothing is overwritten or deleted.
      </p>

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
