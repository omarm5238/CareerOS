"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  beginDelete,
  cancelConfirm,
  confirmDelete,
  deleteFailed,
  deleteSucceeded,
  idleDeleteUi,
  selectJob,
  type JobDeleteUiState,
} from "../lib/job-delete-ui-state";

type DeleteJobButtonProps = {
  jobId: string;
};

export function DeleteJobButton({ jobId }: DeleteJobButtonProps) {
  const router = useRouter();
  const [ui, setUi] = useState<JobDeleteUiState>(idleDeleteUi);
  const uiRef = useRef(ui);
  const inFlight = useRef(false);
  uiRef.current = ui;

  function updateUi(next: JobDeleteUiState) {
    uiRef.current = next;
    setUi(next);
  }

  useEffect(() => {
    setUi((current) => {
      const next = selectJob(current, jobId);
      uiRef.current = next;
      return next;
    });
  }, [jobId]);

  const isDeleting = ui.deletingJobId === jobId;
  const isConfirming = ui.confirmingJobId === jobId;
  const isRemoved = ui.removedJobId === jobId;

  async function handleDelete() {
    if (inFlight.current) return;

    const next = beginDelete(uiRef.current, jobId);
    if (!next) return;

    inFlight.current = true;
    updateUi(next);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Could not delete this job.");
      }

      updateUi(deleteSucceeded(uiRef.current, jobId));
      router.push("/workspace/jobs");
      router.refresh();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this job. Please try again.";
      updateUi(deleteFailed(uiRef.current, jobId, message));
    } finally {
      inFlight.current = false;
    }
  }

  if (isRemoved) {
    return (
      <p className="pt-2 text-sm text-[var(--color-text-secondary)]">This job was deleted.</p>
    );
  }

  if (!isConfirming) {
    return (
      <div className="pt-2">
        <button
          className="text-sm text-[var(--status-danger-text)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          onClick={() => updateUi(confirmDelete(uiRef.current, jobId))}
          type="button"
        >
          Delete job
        </button>
        {ui.error ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]" role="alert">
            {ui.error}
          </p>
        ) : null}
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
          aria-busy={isDeleting}
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
          onClick={() => updateUi(cancelConfirm(uiRef.current, jobId))}
          type="button"
        >
          Cancel
        </button>
      </div>
      {ui.error ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]" role="alert">
          {ui.error}
        </p>
      ) : null}
    </div>
  );
}
