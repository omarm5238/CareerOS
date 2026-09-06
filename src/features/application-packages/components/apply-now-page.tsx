"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PRIORITY_BAND_LABELS } from "@/features/jobs/opportunities/types";
import { JobsSubNav } from "@/features/jobs/components/jobs-sub-nav";

import type { ApplyNowCard, ApplyNowData } from "../types";

type Tab = "ready" | "needs" | "priority" | "prepared" | "all";

function matchesTab(card: ApplyNowCard, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "ready") return card.readinessStatus === "READY";
  if (tab === "needs") return card.readinessStatus === "NEEDS_REVIEW";
  if (tab === "priority") return card.priorityBand === "APPLY_NOW" || card.priorityBand === "HIGH_PRIORITY";
  return Boolean(card.packageId);
}

export function ApplyNowPage({ data }: { data: ApplyNowData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [mode, setMode] = useState(data.preparationMode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);

  const cards = useMemo(() => data.cards.filter((card) => matchesTab(card, tab)), [data.cards, tab]);

  async function setPreparationMode(next: typeof mode) {
    setMode(next);
    await fetch("/api/jobs/discovery/profile/preparation-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
  }

  async function prepareTop() {
    setPending(true);
    setError(null);
    setProgress(["Selecting a bounded candidate window…"]);
    const response = await fetch("/api/application-packages/prepare-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 5 }),
    });
    const json = (await response.json()) as { items?: Array<{ jobPostingId: string | null; status: string; error: string | null }>; message?: string };
    if (!response.ok) {
      setError(json.message ?? "Batch preparation failed.");
      setPending(false);
      return;
    }
    setProgress((json.items ?? []).map((item) => `${item.jobPostingId ?? "job"} · ${item.status}${item.error ? ` · ${item.error}` : ""}`));
    setPending(false);
    router.refresh();
  }

  async function prepareOne(jobPostingId: string) {
    setPending(true);
    const response = await fetch(`/api/jobs/opportunities/${jobPostingId}/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceNewPackage: false }),
    });
    const json = (await response.json()) as { packageId?: string; message?: string };
    setPending(false);
    if (!response.ok || !json.packageId) {
      setError(json.message ?? "Could not prepare this opportunity.");
      return;
    }
    router.push(`/workspace/jobs/apply-now/${json.packageId}`);
  }

  return (
    <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
      <JobsSubNav />
      <header className="mt-6 space-y-3">
        <p className="section-eyebrow">Apply Now</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          {data.counts.readyToReview} opportunities ready today
        </h1>
        <p className="max-w-2xl text-sm text-[var(--color-text-secondary)]">
          Opportunity Score is not Discovery Suitability and is not hiring probability. CareerOS prepares packages. It never submits applications.
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <Metric label="Ready to Review" value={data.counts.readyToReview} />
        <Metric label="Needs Input" value={data.counts.needsInput} />
        <Metric label="High Priority" value={data.counts.highPriority} />
        <Metric label="Prepared Today" value={data.counts.preparedToday} />
      </section>

      <section className="mt-6 surface-glass p-5">
        <p className="section-eyebrow">Preparation Mode</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["MANUAL", "ASSISTED", "AUTO_PREPARE"] as const).map((item) => (
            <button
              key={item}
              className={mode === item ? "btn-primary" : "btn-secondary"}
              onClick={() => void setPreparationMode(item)}
              type="button"
            >
              {item === "AUTO_PREPARE" ? "Auto Prepare" : item === "ASSISTED" ? "Assisted" : "Manual"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Auto Prepare prepares application packages during an explicit prepare action. It never submits applications.
        </p>
        <button className="btn-primary mt-4" disabled={pending} onClick={() => void prepareTop()} type="button">
          Prepare Top Opportunities
        </button>
        {progress.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
            {progress.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
      </section>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Apply Now filters">
        {([
          ["ready", "Ready"],
          ["needs", "Needs Review"],
          ["priority", "High Priority"],
          ["prepared", "Prepared"],
          ["all", "All"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      <ul className="mt-6 space-y-3">
        {cards.map((card) => (
          <li key={`${card.packageId ?? card.jobPostingId}`} className="surface-glass p-5">
            <p className="section-eyebrow">
              {card.priorityBand ? PRIORITY_BAND_LABELS[card.priorityBand] : "Opportunity"}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">{card.title}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{card.company}</p>
            <dl className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
              <div>Opportunity Score {card.opportunityScore ?? "—"}</div>
              <div>Evidence Coverage {card.evidenceCoverage ?? "—"}%</div>
              <div>Application Effort {card.applicationEffort ?? "Unknown"}</div>
              <div>{card.mainGap ? `Gap: ${card.mainGap}` : "No important gap listed"}</div>
            </dl>
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              {card.alreadyApplied
                ? "Already applied"
                : card.readinessStatus === "READY"
                  ? "Ready to review"
                  : card.readinessStatus === "NEEDS_REVIEW"
                    ? "Needs your input"
                    : card.readinessStatus === "BLOCKED"
                      ? "Blocked"
                      : "Not prepared"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {card.packageId ? (
                <Link className="btn-primary" href={`/workspace/jobs/apply-now/${card.packageId}`}>
                  Review
                </Link>
              ) : card.jobPostingId ? (
                <button className="btn-primary" disabled={pending} onClick={() => void prepareOne(card.jobPostingId!)} type="button">
                  Prepare
                </button>
              ) : null}
              {card.jobPostingId ? (
                <Link className="btn-secondary" href={`/workspace/jobs?jobId=${card.jobPostingId}`}>
                  Open Job
                </Link>
              ) : null}
              <button
                className="btn-secondary"
                disabled={pending}
                onClick={() =>
                  void fetch("/api/application-packages/skip", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ packageId: card.packageId, jobPostingId: card.jobPostingId }),
                  }).then(() => router.refresh())
                }
                type="button"
              >
                Skip
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
