"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EVENT_OPTIONS = [
  { value: "INTERVIEW_SCHEDULED", label: "Interview scheduled" },
  { value: "INTERVIEW_COMPLETED", label: "Interview completed" },
  { value: "SCREENING_SCHEDULED", label: "Screening scheduled" },
  { value: "SCREENING_COMPLETED", label: "Screening completed" },
  { value: "ASSESSMENT_RECEIVED", label: "Assessment received" },
  { value: "ASSESSMENT_SCHEDULED", label: "Assessment scheduled" },
  { value: "ASSESSMENT_COMPLETED", label: "Assessment completed" },
  { value: "OFFER_RECEIVED", label: "Offer received" },
  { value: "FOLLOW_UP_SENT", label: "Follow-up sent" },
  { value: "NOTE_ADDED", label: "Note" },
  { value: "OTHER", label: "Other" },
] as const;

const SCHEDULED_TYPES = new Set([
  "INTERVIEW_SCHEDULED",
  "SCREENING_SCHEDULED",
  "ASSESSMENT_SCHEDULED",
]);

export function ApplicationEventForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("INTERVIEW_SCHEDULED");
  const [eventAt, setEventAt] = useState("");
  const [round, setRound] = useState("");
  const [format, setFormat] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const needsSchedule = SCHEDULED_TYPES.has(type);

  async function submit() {
    if (pending) return;

    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            description: description.trim() || null,
            eventAt: eventAt ? new Date(eventAt).toISOString() : null,
            metadata: {
              ...(round.trim() ? { round: round.trim() } : {}),
              ...(format.trim() ? { format: format.trim() } : {}),
            },
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "That event could not be added.");
      }

      setSuccess(body?.message ?? "Event added.");
      setEventAt("");
      setRound("");
      setFormat("");
      setDescription("");
      setOpen(false);
      router.refresh();
    } catch (eventError) {
      setError(
        eventError instanceof Error ? eventError.message : "That event could not be added.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button className="btn-secondary" onClick={() => setOpen((value) => !value)} type="button">
        {open ? "Cancel" : "Add event"}
      </button>

      {open ? (
        <div className="mt-3 surface-card p-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Event type
            </span>
            <select
              className="input-field mt-1 w-full text-sm"
              onChange={(event) => setType(event.target.value)}
              value={type}
            >
              {EVENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              {needsSchedule ? "Scheduled for" : "When it happened"}
            </span>
            <input
              className="input-field mt-1 w-full text-sm"
              onChange={(event) => setEventAt(event.target.value)}
              type="datetime-local"
              value={eventAt}
            />
          </label>

          {needsSchedule ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                  Round
                </span>
                <input
                  className="input-field mt-1 w-full text-sm"
                  onChange={(event) => setRound(event.target.value)}
                  placeholder="Technical Interview"
                  value={round}
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                  Format
                </span>
                <input
                  className="input-field mt-1 w-full text-sm"
                  onChange={(event) => setFormat(event.target.value)}
                  placeholder="Google Meet"
                  value={format}
                />
              </label>
            </div>
          ) : null}

          <label className="mt-3 block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Notes (optional)
            </span>
            <textarea
              className="input-field mt-1 min-h-16 w-full text-sm"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>

          <div className="mt-4">
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => void submit()}
              type="button"
            >
              {pending ? "Adding…" : "Add to timeline"}
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
    </div>
  );
}
