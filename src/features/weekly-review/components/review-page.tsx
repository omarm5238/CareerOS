"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/workspace/confirm-dialog";

import type { WeeklyComponentResult, WeeklyReviewView, WeeklyWorkspaceView } from "../types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "Request failed.");
  return payload;
}

function bandClass(band: string | null) {
  if (band === "STRONG") return "text-[var(--color-text-primary)]";
  if (band === "STEADY") return "text-[var(--color-champagne)]";
  if (band === "MIXED") return "text-[var(--color-text-secondary)]";
  return "text-[var(--color-text-secondary)]";
}

function ComponentCard({ component }: { component: WeeklyComponentResult }) {
  return (
    <article className="surface-glass min-w-0 p-4" data-testid={`component-${component.key}`}>
      <p className="section-eyebrow">{component.label}</p>
      {component.applicability === "NOT_APPLICABLE" || component.score === null ? (
        <p className="mt-2 font-display text-lg">Not applicable this week</p>
      ) : (
        <p className="mt-2 font-display text-lg">
          {Math.round(component.score)} / {component.maxScore}
        </p>
      )}
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{component.evidenceSummary}</p>
      {component.delta !== null && component.delta !== undefined ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          {component.delta > 0 ? "+" : ""}
          {component.delta} vs last finalized week
        </p>
      ) : null}
    </article>
  );
}

export function ReviewBody({
  review,
  busy,
  onAdopt,
  onDismiss,
  onRefresh,
  onFinalize,
}: {
  review: WeeklyReviewView;
  busy: boolean;
  onAdopt?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onRefresh?: () => void;
  onFinalize?: () => void;
}) {
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const execution = review.metrics.filter((metric) => metric.category === "EXECUTION");
  const planned = execution.find((metric) => metric.metricKey === "execution.core_planned")?.numericValue ?? 0;
  const completed = execution.find((metric) => metric.metricKey === "execution.core_completed")?.numericValue ?? 0;
  const deferred = execution.find((metric) => metric.metricKey === "execution.deferred")?.numericValue ?? 0;
  const skipped = execution.find((metric) => metric.metricKey === "execution.skipped")?.numericValue ?? 0;
  const plannedMinutes = execution.find((metric) => metric.metricKey === "execution.planned_minutes")?.numericValue ?? 0;
  const completedMinutes =
    execution.find((metric) => metric.metricKey === "execution.completed_estimated_minutes")?.numericValue ?? 0;

  return (
    <div className="min-w-0">
      <header className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-eyebrow">Weekly Review</p>
          <h2 className="mt-2 font-display text-2xl">{review.weekLabel}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {review.status === "FINALIZED"
              ? "Finalized"
              : review.isCurrent
                ? "Week in progress — metrics may change as the week continues."
                : "Ready to finalize"}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {review.status === "DRAFT" && onRefresh ? (
            <button
              className="inline-flex min-h-9 items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 text-sm"
              data-testid="refresh-review"
              disabled={busy}
              onClick={onRefresh}
              type="button"
            >
              Refresh Review
            </button>
          ) : null}
          {review.status === "DRAFT" && review.isComplete && onFinalize ? (
            <button
              className="inline-flex min-h-9 items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 text-sm"
              data-testid="finalize-review"
              disabled={busy}
              onClick={() => setConfirmFinalize(true)}
              type="button"
            >
              Finalize Review
            </button>
          ) : null}
        </div>
      </header>
      {review.refreshedAt ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Last refreshed {new Date(review.refreshedAt).toLocaleString()}
        </p>
      ) : null}

      <section className="surface-glass mt-6 p-5" data-testid="momentum-hero">
        <p className="section-eyebrow">Career Momentum</p>
        {review.overallMomentumScore === null ? (
          <p className="mt-2 font-display text-3xl">Not enough applicable data yet</p>
        ) : (
          <p className={`mt-2 font-display text-3xl ${bandClass(review.overallMomentumBand)}`}>
            {review.overallMomentumScore} / 100
            <span className="ml-3 text-lg">{review.overallMomentumBand}</span>
          </p>
        )}
        {review.firstReview ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            This is your first weekly baseline. Future finalized reviews will show week-over-week changes.
          </p>
        ) : review.overallDelta !== null ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {review.overallDelta > 0 ? "+" : ""}
            {review.overallDelta} compared with last finalized week
          </p>
        ) : null}
        {review.summary ? <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{review.summary}</p> : null}
      </section>

      <section className="mt-6 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {review.components.map((component) => (
          <ComponentCard component={component} key={component.key} />
        ))}
      </section>

      <section className="surface-glass mt-6 p-4" data-testid="planned-completed">
        <p className="section-eyebrow">Planned vs completed</p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Core actions {completed} / {planned} · Deferred {deferred} · Skipped {skipped}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Estimated planned time {plannedMinutes} min · Estimated completed action time {completedMinutes} min
        </p>
      </section>

      <div className="mt-6 grid min-w-0 gap-3 lg:grid-cols-2">
        <section className="surface-glass p-4" data-testid="wins">
          <h3 className="font-display text-lg">Wins</h3>
          {review.wins.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No factual wins recorded this week.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm leading-6">
              {review.wins.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="surface-glass p-4" data-testid="friction">
          <h3 className="font-display text-lg">Friction</h3>
          {review.friction.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No material friction recorded this week.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm leading-6">
              {review.friction.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6" data-testid="patterns">
        <h3 className="font-display text-lg">Patterns</h3>
        {review.insights.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Not enough activity yet for detailed pattern analysis.
          </p>
        ) : (
          <div className="mt-3 grid min-w-0 gap-3">
            {review.insights.map((item) => (
              <article className="surface-glass p-4" key={item.id}>
                <p className="section-eyebrow">{item.confidenceLabel}</p>
                <h4 className="mt-1 font-display text-base">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.summary}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 grid min-w-0 gap-3 lg:grid-cols-3">
        <article className="surface-glass p-4" data-testid="opportunity-pipeline">
          <h3 className="font-display text-lg">Opportunity pipeline</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
            {["opportunities.strong_discovered", "opportunities.strong_reviewed", "opportunities.strong_prepared", "opportunities.ready_to_apply", "opportunities.expired_unacted"].map((key) => {
              const metric = review.metrics.find((item) => item.metricKey === key);
              return (
                <li key={key}>
                  {key.replace("opportunities.", "").replaceAll("_", " ")}: {metric?.numericValue ?? 0}
                </li>
              );
            })}
          </ul>
        </article>
        <article className="surface-glass p-4" data-testid="application-progress">
          <h3 className="font-display text-lg">Application progress</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
            <li>Submitted: {review.metrics.find((item) => item.metricKey === "applications.submitted")?.numericValue ?? 0}</li>
            <li>Stage progressions: {review.metrics.find((item) => item.metricKey === "applications.stage_progressions")?.numericValue ?? 0}</li>
            <li>Follow-ups due: {review.metrics.find((item) => item.metricKey === "applications.followups_due")?.numericValue ?? 0}</li>
            <li>Follow-ups completed: {review.metrics.find((item) => item.metricKey === "applications.followups_completed")?.numericValue ?? 0}</li>
          </ul>
        </article>
        <article className="surface-glass p-4" data-testid="linkedin-skills">
          <h3 className="font-display text-lg">LinkedIn & evidence</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
            <li>READY: {review.metrics.find((item) => item.metricKey === "linkedin.ready")?.numericValue ?? 0}</li>
            <li>Published: {review.metrics.find((item) => item.metricKey === "linkedin.published")?.numericValue ?? 0}</li>
            <li>Ready unpublished: {review.metrics.find((item) => item.metricKey === "linkedin.ready_unpublished")?.numericValue ?? 0}</li>
            <li>Evidence actions: {review.metrics.find((item) => item.metricKey === "skills.evidence_actions")?.numericValue ?? 0}</li>
          </ul>
        </article>
      </section>

      <section className="mt-6" data-testid="next-week">
        <h3 className="font-display text-lg">Next week</h3>
        {review.recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No grounded next-week recommendations.</p>
        ) : (
          <div className="mt-3 grid min-w-0 gap-3">
            {review.recommendations.map((item) => (
              <article className="surface-glass p-4" data-recommendation-id={item.id} key={item.id}>
                <p className="section-eyebrow">
                  {item.priority} · {item.category.replaceAll("_", " ")}
                </p>
                <h4 className="mt-1 font-display text-base">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.reason}</p>
                {item.deepLink ? (
                  <Link className="mt-2 inline-block text-sm underline" href={item.deepLink}>
                    Open related workspace
                  </Link>
                ) : null}
                {item.status === "ADOPTED" ? (
                  <p className="mt-3 text-sm">Adopted for next-week focus</p>
                ) : item.status === "DISMISSED" ? (
                  <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Dismissed</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="min-h-9 rounded border border-[var(--color-border)] px-3 text-sm"
                      data-testid="adopt-recommendation"
                      disabled={busy}
                      onClick={() => onAdopt?.(item.id)}
                      type="button"
                    >
                      Adopt
                    </button>
                    <button
                      className="min-h-9 px-3 text-sm underline"
                      data-testid="dismiss-recommendation"
                      disabled={busy}
                      onClick={() => onDismiss?.(item.id)}
                      type="button"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {confirmFinalize ? (
        <ConfirmDialog
          confirmLabel="Finalize Review"
          confirmTestId="confirm-finalize"
          onCancel={() => setConfirmFinalize(false)}
          onConfirm={() => {
            setConfirmFinalize(false);
            onFinalize?.();
          }}
          title="Finalize Review"
        >
          Finalizing freezes this weekly snapshot. Future career activity will not rewrite this review.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

export function ReviewPageClient({ initial }: { initial: WeeklyWorkspaceView }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = data.current;

  async function reload() {
    const next = await api<WeeklyWorkspaceView>("/api/weekly-review/current");
    setData(next);
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const history = useMemo(() => data.history, [data.history]);

  return (
    <div className="relative mx-auto min-w-0 module-shell overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      {error ? <p className="mb-4 text-sm text-[var(--color-champagne)]">{error}</p> : null}
      {!review ? (
        <section className="surface-glass p-5">
          <h2 className="font-display text-2xl">Weekly Review</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {data.period.weekLabel} · Week in progress
          </p>
          <button
            className="mt-4 inline-flex min-h-9 items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 text-sm"
            data-testid="generate-review"
            disabled={busy}
            onClick={() => run(async () => { await api("/api/weekly-review/generate", { method: "POST", body: "{}" }); })}
            type="button"
          >
            Generate This Week&apos;s Review
          </button>
          {data.latestCompletedMissing && data.latestCompletedWeekStart ? (
            <button
              className="ml-3 inline-flex min-h-9 items-center px-3 text-sm underline"
              data-testid="generate-last-week"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("/api/weekly-review/generate", {
                    method: "POST",
                    body: JSON.stringify({ weekStartLocalDate: data.latestCompletedWeekStart }),
                  });
                })
              }
              type="button"
            >
              Generate Last Week&apos;s Review
            </button>
          ) : null}
        </section>
      ) : (
        <ReviewBody
          busy={busy}
          onAdopt={(id) => run(async () => { await api(`/api/weekly-review/recommendations/${id}/adopt`, { method: "POST", body: "{}" }); })}
          onDismiss={(id) => run(async () => { await api(`/api/weekly-review/recommendations/${id}/dismiss`, { method: "POST", body: "{}" }); })}
          onFinalize={() => run(async () => { await api(`/api/weekly-review/${review.id}/finalize`, { method: "POST" }); })}
          onRefresh={() => run(async () => { await api(`/api/weekly-review/${review.id}/refresh`, { method: "POST" }); })}
          review={review}
        />
      )}

      <section className="mt-8" data-testid="review-history">
        <h3 className="font-display text-lg">History</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No finalized weeks yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((item) => (
              <li key={item.id}>
                <Link
                  className="block min-h-11 min-w-0 py-2 text-sm underline"
                  data-review-id={item.id}
                  data-testid="history-review-link"
                  href={`/workspace/review/${item.id}`}
                >
                  {item.weekLabel} · {item.overallMomentumScore ?? "—"} {item.overallMomentumBand ?? ""} · {item.activeDays ?? 0} active career days
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
