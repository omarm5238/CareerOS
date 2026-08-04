"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteJobButtonProps = {
  jobId: string;
};

export function DeleteJobButton({ jobId }: DeleteJobButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Could not delete this job.");
      }

      router.push("/workspace/jobs");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this job. Please try again.",
      );
      setIsDeleting(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div className="pt-2">
        <button
          className="text-sm text-[var(--status-danger-text)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          type="button"
        >
          Delete job
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4">
      <p className="text-sm text-[var(--color-text-primary)]">
        Delete this job? This cannot be undone. This only deletes this job. Your resume and
        skills stay intact.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="btn-danger px-3 py-1.5 text-sm"
          disabled={isDeleting}
          onClick={() => void handleDelete()}
          type="button"
        >
          {isDeleting ? "Deleting…" : "Confirm delete"}
        </button>
        <button
          className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] disabled:opacity-50"
          disabled={isDeleting}
          onClick={() => setConfirming(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
