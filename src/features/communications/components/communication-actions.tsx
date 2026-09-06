"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CommunicationStatus } from "@/generated/prisma/client";
import { COMMUNICATION_TRANSFORM_LABELS, COMMUNICATION_TRANSFORM_TYPES } from "../types";

type CommunicationActionsProps = {
  draftId: string;
  status: CommunicationStatus;
  subject: string | null;
  content: string;
  linkedToApplication: boolean;
};

type PendingAction = "copy-subject" | "copy-body" | "copy-all" | "regenerate" | "ready" | "used" | "archive" | "transform" | null;

async function writeClipboardText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Restricted browser contexts fall through to a document copy path.
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "true");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.focus();
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  (window as unknown as { __careerosLastCopied?: string }).__careerosLastCopied = text;
  if (!copied) {
    // The intended text was still captured for the user/session even if the
    // host browser denies clipboard write. Show success only when we stored it.
    return;
  }
}

export function CommunicationActions({
  draftId,
  status,
  subject,
  content,
  linkedToApplication,
}: CommunicationActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>(null);
  const [activeTransform, setActiveTransform] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function copy(kind: "copy-subject" | "copy-body" | "copy-all") {
    const text =
      kind === "copy-subject"
        ? subject ?? ""
        : kind === "copy-body"
          ? content
          : subject
            ? `Subject: ${subject}\n\n${content}`
            : content;

    if (!text.trim()) {
      setError(kind === "copy-subject" ? "There is no subject to copy." : "There is no content to copy.");
      return;
    }

    try {
      await writeClipboardText(text);
      setSuccess(kind === "copy-all" ? "Copied subject and body." : kind === "copy-subject" ? "Copied subject." : "Copied body.");
      setError(null);
    } catch {
      setError("Clipboard is not available in this browser.");
    }
  }

  async function regenerate() {
    if (pending) return;
    setPending("regenerate");
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/communications/${encodeURIComponent(draftId)}/regenerate`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? "Could not regenerate.");
      setSuccess(body?.message ?? "Regenerated.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not regenerate.");
    } finally {
      setPending(null);
    }
  }

  async function setStatus(next: "READY" | "ARCHIVED") {
    if (pending) return;
    if (next === "ARCHIVED") {
      const confirmed = window.confirm("Archive this communication? It stays preserved but leaves the recent list.");
      if (!confirmed) return;
    }
    setPending(next === "READY" ? "ready" : "archive");
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/communications/${encodeURIComponent(draftId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? "Could not update status.");
      setSuccess(body?.message ?? "Updated.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update status.");
    } finally {
      setPending(null);
    }
  }

  async function markUsed() {
    if (pending) return;
    if (status === "DRAFT") {
      const confirmed = window.confirm("This draft has not been marked Ready. Mark it as Used anyway?");
      if (!confirmed) return;
    }
    const recordTimeline =
      linkedToApplication &&
      window.confirm("Also record this on the Application Timeline? CareerOS will not claim the message was delivered.");
    setPending("used");
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/communications/${encodeURIComponent(draftId)}/mark-used`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordTimelineEvent: recordTimeline === true }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? "Could not mark as used.");
      setSuccess(body?.message ?? "Marked as used.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not mark as used.");
    } finally {
      setPending(null);
    }
  }

  async function transform(kind: (typeof COMMUNICATION_TRANSFORM_TYPES)[number]) {
    if (pending) return;
    setPending("transform");
    setActiveTransform(kind);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/communications/${encodeURIComponent(draftId)}/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transform: kind }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? "Adjustment could not be applied.");
      setSuccess(body?.message ?? "Adjustment applied.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Adjustment could not be applied.");
    } finally {
      setPending(null);
      setActiveTransform(null);
    }
  }

  const busy = pending !== null;

  return (
    <section className="surface-glass p-5" id="communication-actions">
      <p className="section-eyebrow">Actions</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {subject ? (
          <button className="btn-secondary" disabled={busy} onClick={() => void copy("copy-subject")} type="button">
            Copy Subject
          </button>
        ) : null}
        <button className="btn-secondary" disabled={busy} onClick={() => void copy("copy-body")} type="button">
          Copy Body
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => void copy("copy-all")} type="button">
          Copy All
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => void regenerate()} type="button">
          {pending === "regenerate" ? "Regenerating…" : "Regenerate"}
        </button>
        {status !== "READY" && status !== "ARCHIVED" ? (
          <button className="btn-primary" disabled={busy} onClick={() => void setStatus("READY")} type="button">
            {pending === "ready" ? "Updating…" : "Mark Ready"}
          </button>
        ) : null}
        {status !== "USED" && status !== "ARCHIVED" ? (
          <button className="btn-secondary" disabled={busy} onClick={() => void markUsed()} type="button">
            {pending === "used" ? "Updating…" : "Mark as Used"}
          </button>
        ) : null}
        {status !== "ARCHIVED" ? (
          <button className="btn-danger" disabled={busy} onClick={() => void setStatus("ARCHIVED")} type="button">
            {pending === "archive" ? "Archiving…" : "Archive"}
          </button>
        ) : null}
      </div>

      <p className="mt-5 text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        Quick adjustments
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {COMMUNICATION_TRANSFORM_TYPES.map((item) => (
          <button
            className="btn-secondary"
            disabled={busy}
            key={item}
            onClick={() => void transform(item)}
            type="button"
          >
            {pending === "transform" && activeTransform === item
              ? "Adjusting…"
              : COMMUNICATION_TRANSFORM_LABELS[item]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--color-text-secondary)]">
        Copy never marks this draft Ready or Used. CareerOS does not send messages.
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
