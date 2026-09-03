"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";
import { JobsSubNav } from "@/features/jobs/components/jobs-sub-nav";
import type { ApplicationQueueListItem } from "../../discovery/types";
import { SCORE_BAND_LABELS } from "../../discovery/constants";

type QueuePageProps = {
  items: ApplicationQueueListItem[];
};

export function ApplicationQueuePage({ items: initialItems }: QueuePageProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [preparing, setPreparing] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const readyCount = items.filter((i) => i.preparationState === "READY_TO_APPLY").length;
  const needsReview = items.filter((i) => i.preparationState === "NEEDS_RESUME_REVIEW").length;
  const notPrepared = items.filter((i) => i.preparationState === "NOT_PREPARED").length;

  const handlePrepare = useCallback(async (queueItemId: string) => {
    setPreparing((s) => new Set(s).add(queueItemId));
    try {
      const res = await fetch(`/api/jobs/discovery/queue/${queueItemId}/prepare`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setPreparing((s) => {
        const n = new Set(s);
        n.delete(queueItemId);
        return n;
      });
    }
  }, [router]);

  const handlePrepareSelected = useCallback(async () => {
    const ids = [...selected];
    for (let i = 0; i < ids.length; i += 2) {
      await Promise.all(ids.slice(i, i + 2).map((id) => handlePrepare(id)));
    }
    setSelected(new Set());
    router.refresh();
  }, [selected, handlePrepare, router]);

  const handleStartApplication = useCallback(async (queueItemId: string) => {
    const res = await fetch(`/api/jobs/discovery/queue/${queueItemId}/start-application`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.applicationId) {
      router.push(`/workspace/applications/${data.applicationId}`);
    }
    router.refresh();
  }, [router]);

  const handleRemove = useCallback(async (queueItemId: string) => {
    await fetch(`/api/jobs/discovery/queue/${queueItemId}/remove`, { method: "POST" });
    setItems((prev) => prev.filter((i) => i.id !== queueItemId));
    router.refresh();
  }, [router]);

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <WorkspaceModuleLayout title="Application Queue">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative mx-auto module-shell px-6 py-8 lg:px-8">
          <JobsSubNav />

          <header className="mt-6 space-y-4">
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Application Queue</h1>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)]">
              <span>{items.length} queued</span>
              <span>{readyCount} ready to apply</span>
              <span>{needsReview} need resume review</span>
              <span>{notPrepared} not prepared</span>
            </div>
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={handlePrepareSelected}
                className="rounded-lg border border-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-accent)]"
              >
                Prepare Selected ({selected.size})
              </button>
            ) : null}
          </header>

          <div className="mt-8 space-y-4">
            {items.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No items in queue. Add strong matches from{" "}
                <Link href="/workspace/jobs/discover" className="text-[var(--color-accent)] hover:underline">
                  Job Discovery
                </Link>
                .
              </p>
            ) : (
              items.map((item) => (
                <article key={item.id} className="surface-glass p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{item.title}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">{item.company}</p>
                      {item.discoveryScore != null ? (
                        <p className="mt-2 text-sm">
                          <span className="text-[var(--color-text-secondary)]">Discovery Suitability: </span>
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {item.discoveryScore}
                            {item.scoreBand ? ` · ${SCORE_BAND_LABELS[item.scoreBand] ?? item.scoreBand}` : ""}
                          </span>
                        </p>
                      ) : null}
                      {item.resumeVersionTitle ? (
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Resume: {item.resumeVersionTitle} · {item.resumeStatus ?? "—"}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs uppercase tracking-wider text-[var(--color-intelligence)]">
                        {item.preparationState.replace(/_/g, " ")}
                      </p>
                      {item.preparationError ? (
                        <p className="mt-1 text-sm text-red-400">{item.preparationError}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="mr-2"
                        aria-label={`Select ${item.title}`}
                      />
                      {item.preparationState === "NOT_PREPARED" || item.preparationState === "FAILED" ? (
                        <button
                          type="button"
                          disabled={preparing.has(item.id)}
                          onClick={() => handlePrepare(item.id)}
                          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
                        >
                          {preparing.has(item.id) ? "Preparing…" : "Prepare"}
                        </button>
                      ) : null}
                      {item.preparationState === "NEEDS_RESUME_REVIEW" && item.resumeVersionId ? (
                        <Link
                          href={`/workspace/resume/versions/${item.resumeVersionId}`}
                          className="rounded-lg border border-[var(--color-accent)] px-3 py-1.5 text-sm text-[var(--color-accent)]"
                        >
                          Open Resume
                        </Link>
                      ) : null}
                      {item.preparationState === "READY_TO_APPLY" ? (
                        <button
                          type="button"
                          onClick={() => handleStartApplication(item.id)}
                          className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white"
                        >
                          Start Application
                        </button>
                      ) : null}
                      {item.applicationId ? (
                        <Link
                          href={`/workspace/applications/${item.applicationId}`}
                          className="rounded-lg px-3 py-1.5 text-sm text-[var(--color-accent)] hover:underline"
                        >
                          Open Application
                        </Link>
                      ) : null}
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:underline"
                        >
                          Open Source
                        </a>
                      ) : null}
                      {item.queueStatus !== "HANDED_OFF" ? (
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          className="rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-secondary)]"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
