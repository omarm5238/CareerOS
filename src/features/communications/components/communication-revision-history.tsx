"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CommunicationRevisionSummary } from "../types";
import { CommunicationSourceBadge, formatCommunicationDateTime } from "./communication-status-badge";

type CommunicationRevisionHistoryProps = {
  draftId: string;
  revisions: CommunicationRevisionSummary[];
};

export function CommunicationRevisionHistory({
  draftId,
  revisions,
}: CommunicationRevisionHistoryProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate(revisionId: string) {
    if (pendingId) return;
    setPendingId(revisionId);
    setError(null);
    try {
      const response = await fetch(`/api/communications/${encodeURIComponent(draftId)}/active-revision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? "Could not set this revision active.");
      router.refresh();
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Could not set this revision active.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="surface-glass p-5" id="revision-history">
      <p className="section-eyebrow">Revision History</p>
      <ul className="mt-4 space-y-3">
        {revisions.map((revision) => (
          <li
            key={revision.id}
            className="rounded-md border border-[var(--color-border)] px-3 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--color-text-primary)]">
                Revision {revision.revisionNumber}
              </span>
              <CommunicationSourceBadge model={revision.model} source={revision.source} />
              {revision.transform ? (
                <span className="status-chip status-chip--mono">{revision.transform.replaceAll("_", " ")}</span>
              ) : null}
              {revision.isActive ? <span className="status-chip status-chip--success">Active</span> : null}
            </div>
            <p className="mt-1 font-mono-meta text-[var(--color-text-secondary)]">
              {formatCommunicationDateTime(revision.createdAt)}
            </p>
            {!revision.isActive ? (
              <button
                className="btn-secondary mt-3"
                disabled={pendingId !== null}
                onClick={() => void activate(revision.id)}
                type="button"
              >
                {pendingId === revision.id ? "Setting…" : "Set Active"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
