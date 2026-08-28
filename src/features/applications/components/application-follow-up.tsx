"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatApplicationDateTime } from "./application-badges";

type ApplicationFollowUpProps = {
  applicationId: string;
  followUpAt: string | null;
  disabled: boolean;
};

function toLocalInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ApplicationFollowUp({
  applicationId,
  followUpAt,
  disabled,
}: ApplicationFollowUpProps) {
  const router = useRouter();
  const [value, setValue] = useState(() => toLocalInputValue(followUpAt));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run(action: "schedule" | "clear" | "sent") {
    if (pending) return;

    setPending(action);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}/follow-up`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            followUpAt: action === "schedule" && value ? new Date(value).toISOString() : null,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "That follow-up change could not be saved.");
      }

      if (action !== "schedule") setValue("");
      setSuccess(body?.message ?? "Follow-up updated.");
      router.refresh();
    } catch (followUpError) {
      setError(
        followUpError instanceof Error
          ? followUpError.message
          : "That follow-up change could not be saved.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="surface-glass p-5" id="follow-up">
      <p className="section-eyebrow">Follow-up</p>

      <p className="mt-2 text-sm text-[var(--color-text-primary)]">
        {followUpAt
          ? `Scheduled for ${formatApplicationDateTime(followUpAt)}`
          : "No follow-up scheduled."}
      </p>

      {disabled ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          This application is closed, so follow-ups are no longer tracked.
        </p>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Follow-up date
            </span>
            <input
              className="input-field mt-1 w-full text-sm"
              onChange={(event) => setValue(event.target.value)}
              type="datetime-local"
              value={value}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={pending !== null || !value}
              onClick={() => void run("schedule")}
              type="button"
            >
              {pending === "schedule" ? "Saving…" : "Schedule follow-up"}
            </button>
            {followUpAt ? (
              <>
                <button
                  className="btn-secondary"
                  disabled={pending !== null}
                  onClick={() => void run("sent")}
                  type="button"
                >
                  {pending === "sent" ? "Saving…" : "Mark follow-up sent"}
                </button>
                <button
                  className="btn-secondary"
                  disabled={pending !== null}
                  onClick={() => void run("clear")}
                  type="button"
                >
                  {pending === "clear" ? "Saving…" : "Clear"}
                </button>
              </>
            ) : null}
          </div>
        </>
      )}

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
