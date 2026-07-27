"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteResumeHistoryItemButtonProps = {
  documentId: string;
};

export function DeleteResumeHistoryItemButton({
  documentId,
}: DeleteResumeHistoryItemButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/resume/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      });

      const body = (await response.json()) as {
        ok?: boolean;
        nextDocumentId?: string | null;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body?.message ?? "Could not delete this resume analysis.");
      }

      if (body.nextDocumentId) {
        router.push(
          `/workspace/resume?documentId=${encodeURIComponent(body.nextDocumentId)}`,
        );
      } else {
        router.push("/workspace/resume");
      }
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this resume analysis.",
      );
      setIsDeleting(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        className="text-[11px] text-[rgb(252_165_165)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);
          setConfirming(true);
        }}
        type="button"
      >
        Delete
      </button>
    );
  }

  return (
    <div
      className="mt-2 rounded-[var(--radius-md)] border border-[rgb(239_68_68_/_25%)] bg-[rgb(239_68_68_/_8%)] p-2"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <p className="text-[11px] text-[var(--color-text-secondary)]">
        Delete this analysis? This cannot be undone. This does not delete your account or jobs.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="rounded border border-[rgb(239_68_68_/_40%)] px-2 py-1 text-[11px] text-[rgb(252_165_165)] disabled:opacity-50"
          disabled={isDeleting}
          onClick={() => void handleDelete()}
          type="button"
        >
          {isDeleting ? "Deleting…" : "Confirm"}
        </button>
        <button
          className="rounded border border-[var(--color-border-subtle)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] disabled:opacity-50"
          disabled={isDeleting}
          onClick={() => setConfirming(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
