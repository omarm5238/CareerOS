"use client";

import { useState } from "react";
import type { DiscoveryListItem } from "../../discovery/types";
import { SCORE_BAND_LABELS, PROVIDER_LABELS } from "../constants";

type DiscoveredJobCardProps = {
  job: DiscoveryListItem;
  minimumScore: number;
  onAddToQueue: (id: string) => Promise<void>;
  onDismiss: (id: string, reason?: string) => Promise<void>;
};

function ScoreBadge({ score, band }: { score: number | null; band: string | null }) {
  if (score == null) return null;
  const label = band ? SCORE_BAND_LABELS[band] ?? band : "";
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">{score}</span>
      {label ? (
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</span>
      ) : null}
    </div>
  );
}

export function DiscoveredJobCard({ job, onAddToQueue, onDismiss }: DiscoveredJobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const inQueue = !!job.queueItemId;
  const isSaved = !!job.jobPostingId;
  const hasApplication = !!job.applicationId;

  async function handleAdd() {
    setLoading(true);
    try { await onAddToQueue(job.id); } finally { setLoading(false); }
  }

  async function handleDismiss() {
    setDismissing(true);
    try { await onDismiss(job.id, "Not interested"); } finally { setDismissing(false); }
  }

  return (
    <article className="surface-glass p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ScoreBadge score={job.finalScore} band={job.scoreBand} />
          <h3 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{job.title}</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{job.company}</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {[job.workMode !== "UNKNOWN" ? job.workMode : null, job.location].filter(Boolean).join(" · ")}
            {job.postedAt ? ` · Posted ${new Date(job.postedAt).toLocaleDateString()}` : ""}
          </p>
          {job.providers.length > 0 ? (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Source: {job.providers.map(p => PROVIDER_LABELS[p] ?? p).join(", ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {hasApplication ? (
            <span className="rounded px-2 py-1 text-xs bg-[var(--surface-soft-glass)] text-[var(--color-text-secondary)]">
              Application tracked
            </span>
          ) : inQueue ? (
            <span className="rounded px-2 py-1 text-xs bg-[var(--surface-soft-glass)] text-[var(--color-intelligence)]">
              In Queue
            </span>
          ) : isSaved ? (
            <span className="rounded px-2 py-1 text-xs bg-[var(--surface-soft-glass)] text-[var(--color-text-secondary)]">
              Saved in Jobs
            </span>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleAdd}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-accent)] disabled:opacity-50"
            >
              {loading ? "Adding…" : "Add to Queue"}
            </button>
          )}
          {job.sourceUrl ? (
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-accent)] hover:underline"
            >
              Open Source
            </a>
          ) : null}
          {!job.dismissedAt ? (
            <button
              type="button"
              disabled={dismissing}
              onClick={handleDismiss}
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>

      {job.matchSummary ? (
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">Why it fits</p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">{job.matchSummary}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-[var(--color-accent)] hover:underline"
      >
        {expanded ? "Hide details" : "Show details"}
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-[var(--color-border-subtle)] pt-3 text-sm">
          {job.evidence.length > 0 ? (
            <div>
              <p className="text-xs uppercase text-[var(--color-text-secondary)]">Strong evidence</p>
              <ul className="mt-1 list-disc pl-4 text-[var(--color-text-primary)]">
                {job.evidence.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          ) : null}
          {job.matchedSkills.length > 0 ? (
            <div>
              <p className="text-xs uppercase text-[var(--color-text-secondary)]">Matched skills</p>
              <p className="mt-1 text-[var(--color-text-primary)]">{job.matchedSkills.join(", ")}</p>
            </div>
          ) : null}
          {job.missingSkills.length > 0 ? (
            <div>
              <p className="text-xs uppercase text-[var(--color-text-secondary)]">Main gaps</p>
              <p className="mt-1 text-[var(--color-text-primary)]">{job.missingSkills.join(", ")}</p>
            </div>
          ) : null}
          {(job.hardBlockers.length > 0 || job.softBlockers.length > 0) ? (
            <div>
              <p className="text-xs uppercase text-[var(--color-text-secondary)]">Blockers / review</p>
              <ul className="mt-1 list-disc pl-4 text-[var(--color-text-primary)]">
                {[...job.hardBlockers, ...job.softBlockers].map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ) : null}
          {job.analysisSource ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Discovery Suitability · {job.analysisSource === "AI_ENHANCED" ? "AI enhanced" : "Rule-based"}
            </p>
          ) : null}
          {job.jobPostingId ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Opportunity analysis available ·{" "}
              <a className="text-[var(--color-accent)] hover:underline" href={`/workspace/jobs?jobId=${job.jobPostingId}`}>
                Prepare Application
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
