"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from "@/features/jobs/constants/application-status";
import type { ApplicationStatus, JobDetailView } from "@/features/jobs";

type JobApplicationTrackerProps = {
  job: JobDetailView;
};

function formatAppliedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function JobApplicationTracker({ job }: JobApplicationTrackerProps) {
  const router = useRouter();
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>(
    job.applicationStatus,
  );
  const [applicationNotes, setApplicationNotes] = useState(job.applicationNotes ?? "");
  const [appliedAt, setAppliedAt] = useState<string | null>(job.appliedAt);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    setApplicationStatus(job.applicationStatus);
    setApplicationNotes(job.applicationNotes ?? "");
    setAppliedAt(job.appliedAt);
    setError(null);
    setSuccess(null);
    setStatus("idle");
  }, [job.id, job.applicationStatus, job.applicationNotes, job.appliedAt]);

  const isSaving = status === "saving";
  const appliedDateLabel = formatAppliedAt(appliedAt);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setStatus("saving");
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          applicationStatus,
          applicationNotes: applicationNotes.trim() || null,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | JobDetailView
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && "message" in body && body.message
            ? body.message
            : "Could not update application. Please try again.",
        );
      }

      if (!body || !("id" in body)) {
        throw new Error("Application update returned an invalid response.");
      }

      setApplicationStatus(body.applicationStatus);
      setApplicationNotes(body.applicationNotes ?? "");
      setAppliedAt(body.appliedAt);
      setSuccess("Application updated.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not update application. Please try again.",
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section
      aria-labelledby="application-status-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="application-status-heading"
      >
        Application Status
      </h2>

      <form className="mt-4 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label
            className="block text-xs text-[var(--color-text-secondary)]"
            htmlFor={`application-status-${job.id}`}
          >
            Status
          </label>
          <select
            className="input-field mt-1"
            id={`application-status-${job.id}`}
            onChange={(event) =>
              setApplicationStatus(event.target.value as ApplicationStatus)
            }
            value={applicationStatus}
          >
            {APPLICATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {APPLICATION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-xs text-[var(--color-text-secondary)]"
            htmlFor={`application-notes-${job.id}`}
          >
            Notes
          </label>
          <textarea
            className="input-field mt-1 min-h-24"
            id={`application-notes-${job.id}`}
            onChange={(event) => setApplicationNotes(event.target.value)}
            placeholder="Interview prep, recruiter contact, follow-up notes…"
            value={applicationNotes}
          />
        </div>

        {appliedDateLabel ? (
          <p className="text-xs text-[var(--color-text-secondary)]">
            Applied on {appliedDateLabel}
          </p>
        ) : null}

        <button
          className="btn-primary"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save application"}
        </button>

        <div aria-live="polite">
          {error ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-text)]">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-xs text-[var(--color-text-secondary)]">{success}</p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
