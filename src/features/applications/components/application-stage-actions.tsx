"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApplicationStatus } from "@/generated/prisma/client";

import { APPLICATION_STATUS_LABELS } from "../lib/application-state";

type ApplicationStageActionsProps = {
  applicationId: string;
  status: ApplicationStatus;
  transitions: ApplicationStatus[];
};

const REJECTION_SOURCES = [
  { value: "EMPLOYER_STATED", label: "Employer stated" },
  { value: "USER_CONFIRMED_FACT", label: "User confirmed fact" },
  { value: "OTHER_CONFIRMED", label: "Other confirmed" },
] as const;

export function ApplicationStageActions({
  applicationId,
  status,
  transitions,
}: ApplicationStageActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<ApplicationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectionOpen, setRejectionOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionSource, setRejectionSource] =
    useState<(typeof REJECTION_SOURCES)[number]["value"]>("EMPLOYER_STATED");

  async function transition(toStatus: ApplicationStatus, extra?: Record<string, unknown>) {
    if (pending) return;

    setPending(toStatus);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: toStatus, ...extra }),
        },
      );

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "That stage change could not be completed.");
      }

      setSuccess(body?.message ?? "Application stage updated.");
      setRejectionOpen(false);
      setRejectionReason("");
      router.refresh();
    } catch (transitionError) {
      setError(
        transitionError instanceof Error
          ? transitionError.message
          : "That stage change could not be completed.",
      );
    } finally {
      setPending(null);
    }
  }

  if (transitions.length === 0) {
    return (
      <section className="surface-glass p-5" id="stage-actions">
        <p className="section-eyebrow">Stage</p>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          This application is closed as {APPLICATION_STATUS_LABELS[status]}. Its history is kept
          for future analysis.
        </p>
      </section>
    );
  }

  return (
    <section className="surface-glass p-5" id="stage-actions">
      <p className="section-eyebrow">Stage</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Currently {APPLICATION_STATUS_LABELS[status]}.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {transitions.map((target) => {
          const isRejection = target === "REJECTED";
          const isPrimary = target === "APPLIED";

          return (
            <button
              className={isPrimary ? "btn-primary" : "btn-secondary"}
              disabled={pending !== null}
              key={target}
              onClick={() => {
                if (isRejection) {
                  setRejectionOpen((open) => !open);
                  return;
                }
                void transition(target);
              }}
              type="button"
            >
              {pending === target
                ? "Updating…"
                : target === "APPLIED"
                  ? "Mark Applied"
                  : `Move to ${APPLICATION_STATUS_LABELS[target]}`}
            </button>
          );
        })}
      </div>

      {rejectionOpen ? (
        <div className="mt-4 surface-card p-4">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Record a rejection</p>
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
            Confirmed reason should contain only information actually stated by the employer or
            otherwise known as fact. Leave it empty if you were not given a reason.
          </p>

          <label className="mt-3 block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Confirmed rejection reason (optional)
            </span>
            <textarea
              className="input-field mt-1 min-h-20 w-full text-sm"
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Exactly what the employer told you, if anything."
              value={rejectionReason}
            />
          </label>

          <label className="mt-3 block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Reason source
            </span>
            <select
              className="input-field mt-1 w-full text-sm"
              onChange={(event) =>
                setRejectionSource(
                  event.target.value as (typeof REJECTION_SOURCES)[number]["value"],
                )
              }
              value={rejectionSource}
            >
              {REJECTION_SOURCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn-danger"
              disabled={pending !== null}
              onClick={() =>
                void transition("REJECTED", {
                  confirmedRejectionReason: rejectionReason.trim() || null,
                  confirmedRejectionSource: rejectionReason.trim() ? rejectionSource : null,
                })
              }
              type="button"
            >
              {pending === "REJECTED" ? "Saving…" : "Record rejection"}
            </button>
            <button
              className="btn-secondary"
              disabled={pending !== null}
              onClick={() => setRejectionOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-[var(--color-danger,#e5a3a3)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
