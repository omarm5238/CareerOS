"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type {
  CareerWeekday,
  DailyRoadmapActionView,
  DailyRoadmapPreferenceView,
  TodayWorkspaceView,
} from "../types";
import { CAREER_WEEKDAYS, ESTIMATED_MINUTE_BUCKETS } from "../types";

const WEEKDAY_LABEL: Record<CareerWeekday, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

function bandClass(band: DailyRoadmapActionView["priorityBand"]) {
  if (band === "CRITICAL") return "border-[var(--color-champagne)] text-[var(--color-champagne)]";
  if (band === "HIGH") return "border-[var(--color-intelligence)] text-[var(--color-intelligence)]";
  return "border-[var(--color-border)] text-[var(--color-text-secondary)]";
}

function domainLabel(action: DailyRoadmapActionView) {
  if (action.type.startsWith("JOB_")) return "Jobs";
  if (action.type.startsWith("APPLICATION_") || action.type.includes("PREP")) return "Applications";
  if (action.type.startsWith("RESUME")) return "Resume";
  if (action.type.startsWith("COMMUNICATION")) return "Communications";
  if (action.type.startsWith("LINKEDIN")) return "LinkedIn";
  if (action.type === "SKILL_DEVELOPMENT" || action.type === "EVIDENCE_BUILDING") return "Skills";
  if (action.type === "CUSTOM_CAREER_ACTION") return "Career action";
  return "Career";
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }
  return payload;
}

function ActionCard({
  action,
  emphasize,
  busy,
  onComplete,
  onDefer,
  onSkip,
}: {
  action: DailyRoadmapActionView;
  emphasize?: boolean;
  busy: boolean;
  onComplete: (id: string) => void;
  onDefer: (id: string, preset: "TOMORROW" | "LATER_THIS_WEEK") => void;
  onSkip: (id: string, reason: string) => void;
}) {
  const [deferOpen, setDeferOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [deferDate, setDeferDate] = useState("");

  return (
    <article
      className={`surface-glass min-w-0 p-4 ${emphasize ? "border-[var(--color-border)]" : ""}`}
      data-action-id={action.id}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="section-eyebrow">{domainLabel(action)}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${bandClass(action.priorityBand)}`}>
          {action.priorityBand}
        </span>
        <span className="text-[11px] text-[var(--color-text-secondary)]" data-testid="action-minutes">
          {action.estimatedMinutes} min
        </span>
      </div>
      <h3 className="mt-2 font-display text-base text-[var(--color-text-primary)]">{action.title}</h3>
      {action.whyNow ? (
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{action.whyNow}</p>
      ) : null}
      {action.blockedReason ? (
        <p className="mt-2 text-sm text-[var(--color-champagne)]">{action.blockedReason}</p>
      ) : null}
      {action.deferredUntil ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Deferred until {action.deferredUntil}</p>
      ) : null}
      {action.status === "COMPLETED" && action.completionSource ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Completed · {action.completionSource.replaceAll("_", " ")}</p>
      ) : null}

      {action.status === "PLANNED" || action.status === "IN_PROGRESS" || action.status === "BLOCKED" ? (
        <div className="mt-4 flex min-w-0 flex-wrap gap-2">
          {action.deepLink ? (
            <Link
              className="inline-flex min-h-9 items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--surface-elevated)] px-3 text-sm"
              href={action.deepLink}
            >
              {action.primaryActionLabel}
            </Link>
          ) : null}
          <button
            className="inline-flex min-h-9 items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 text-sm"
            disabled={busy}
            onClick={() => onComplete(action.id)}
            type="button"
          >
            Complete
          </button>
          <button
            className="inline-flex min-h-9 items-center rounded-[var(--radius-lg)] border border-transparent px-3 text-sm text-[var(--color-text-secondary)]"
            disabled={busy}
            onClick={() => setDeferOpen((value) => !value)}
            type="button"
          >
            Defer
          </button>
          <button
            className="inline-flex min-h-9 items-center rounded-[var(--radius-lg)] border border-transparent px-3 text-sm text-[var(--color-text-secondary)]"
            disabled={busy}
            onClick={() => setSkipOpen((value) => !value)}
            type="button"
          >
            Skip
          </button>
        </div>
      ) : null}

      {deferOpen ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="text-xs underline" onClick={() => onDefer(action.id, "TOMORROW")} type="button">
            Tomorrow
          </button>
          <button className="text-xs underline" onClick={() => onDefer(action.id, "LATER_THIS_WEEK")} type="button">
            Later this week
          </button>
          <input
            className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs"
            onChange={(event) => setDeferDate(event.target.value)}
            type="date"
            value={deferDate}
          />
          <button
            className="text-xs underline"
            onClick={async () => {
              if (!deferDate) return;
              await api("/api/daily-roadmap/actions/" + action.id + "/defer", {
                method: "POST",
                body: JSON.stringify({ deferredUntil: deferDate }),
              });
              window.location.reload();
            }}
            type="button"
          >
            Pick date
          </button>
        </div>
      ) : null}

      {skipOpen ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[
            ["NOT_RELEVANT", "Not relevant"],
            ["NO_TIME", "No time"],
            ["ALREADY_DONE", "Already done"],
            ["BLOCKED", "Blocked"],
            ["OTHER", "Other"],
          ].map(([reason, label]) => (
            <button className="underline" key={reason} onClick={() => onSkip(action.id, reason)} type="button">
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function TodayPageClient({ initial }: { initial: TodayWorkspaceView }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [prefs, setPrefs] = useState<DailyRoadmapPreferenceView>(initial.preferences);

  const headerDate = data.roadmap?.localDate ?? data.localDate;

  async function reload() {
    const next = await api<TodayWorkspaceView>("/api/daily-roadmap/today");
    setData(next);
    setPrefs(next.preferences);
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

  const streakCopy = useMemo(() => {
    if (data.streak.currentStreak === 0) {
      return "Current streak: 0. Complete a meaningful career action today to start a new streak.";
    }
    return `${data.streak.currentStreak} active career days`;
  }, [data.streak.currentStreak]);

  return (
    <div className="relative mx-auto min-w-0 module-shell overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="section-eyebrow">Today</p>
          <h2 className="mt-2 font-display text-2xl">{headerDate}</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Actions {data.progress.completedActions} / {Math.max(data.progress.plannedActions, data.progress.completedActions)} complete
            · Estimated minutes {data.progress.completedEstimatedMinutes} / {data.progress.plannedEstimatedMinutes}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {!data.roadmap ? (
            <button
              className="inline-flex min-h-9 items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--surface-elevated)] px-3 text-sm"
              data-testid="generate-today"
              disabled={busy}
              onClick={() => run(async () => { await api("/api/daily-roadmap/today/generate", { method: "POST" }); })}
              type="button"
            >
              Generate Today
            </button>
          ) : (
            <button
              className="inline-flex min-h-9 items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--surface-elevated)] px-3 text-sm"
              data-testid="refresh-today"
              disabled={busy}
              onClick={() => run(async () => { await api("/api/daily-roadmap/today/refresh", { method: "POST" }); })}
              type="button"
            >
              Refresh Today
            </button>
          )}
          <button className="inline-flex min-h-9 items-center px-3 text-sm underline" onClick={() => setSettingsOpen(true)} type="button">
            Settings
          </button>
          <button className="inline-flex min-h-9 items-center px-3 text-sm underline" onClick={() => setCustomOpen(true)} type="button">
            Add Career Action
          </button>
        </div>
      </header>

      {data.roadmap?.refreshedAt ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Last refreshed {new Date(data.roadmap.refreshedAt).toLocaleString()}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[var(--color-champagne)]">{error}</p> : null}

      <section className="surface-glass mt-6 p-4" data-testid="streak-card">
        <p className="section-eyebrow">Career Streak</p>
        <p className="mt-2 font-display text-xl">{streakCopy}</p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          This week {data.streak.activeDaysThisWeek} / {data.streak.scheduledDaysThisWeek} scheduled days
        </p>
      </section>

      {data.emptyState === "first_use" || (!data.roadmap && data.firstUseSuggestions.length > 0) ? (
        <section className="surface-glass mt-6 p-5">
          <h3 className="font-display text-lg">Build today&apos;s career plan</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.firstUseSuggestions.map((item) => (
              <li key={item.title}>
                <Link className="underline" href={item.deepLink}>
                  {item.title}
                </Link>
                <p className="text-[var(--color-text-secondary)]">{item.whyNow}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.roadmap && data.roadmap.topPriorities.length === 0 ? (
        <section className="surface-glass mt-6 p-5">
          <h3 className="font-display text-lg">You&apos;re clear on urgent career actions today.</h3>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            If growth work is available, it appears below. CareerOS will not invent urgency.
          </p>
        </section>
      ) : null}

      {data.roadmap?.topPriorities.length ? (
        <section className="mt-8">
          <h3 className="font-display text-lg">Top Priorities</h3>
          <div className="mt-3 grid min-w-0 gap-3">
            {data.roadmap.topPriorities.map((action) => (
              <ActionCard
                action={action}
                busy={busy}
                emphasize
                key={action.id}
                onComplete={(id) => run(async () => { await api(`/api/daily-roadmap/actions/${id}/complete`, { method: "POST", body: "{}" }); })}
                onDefer={(id, preset) => run(async () => { await api(`/api/daily-roadmap/actions/${id}/defer`, { method: "POST", body: JSON.stringify({ preset }) }); })}
                onSkip={(id, reason) => run(async () => { await api(`/api/daily-roadmap/actions/${id}/skip`, { method: "POST", body: JSON.stringify({ reason }) }); })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.roadmap?.remainingCore.length ? (
        <section className="mt-8">
          <h3 className="font-display text-lg">Remaining Today</h3>
          <div className="mt-3 grid min-w-0 gap-3">
            {data.roadmap.remainingCore.map((action) => (
              <ActionCard
                action={action}
                busy={busy}
                key={action.id}
                onComplete={(id) => run(async () => { await api(`/api/daily-roadmap/actions/${id}/complete`, { method: "POST", body: "{}" }); })}
                onDefer={(id, preset) => run(async () => { await api(`/api/daily-roadmap/actions/${id}/defer`, { method: "POST", body: JSON.stringify({ preset }) }); })}
                onSkip={(id, reason) => run(async () => { await api(`/api/daily-roadmap/actions/${id}/skip`, { method: "POST", body: JSON.stringify({ reason }) }); })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.roadmap?.optionalLater.length ? (
        <section className="mt-8">
          <h3 className="text-sm uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">If Time</h3>
          <div className="mt-3 grid min-w-0 gap-3 opacity-90">
            {data.roadmap.optionalLater.map((action) => (
              <ActionCard
                action={action}
                busy={busy}
                key={action.id}
                onComplete={(id) => run(async () => { await api(`/api/daily-roadmap/actions/${id}/complete`, { method: "POST", body: "{}" }); })}
                onDefer={(id, preset) => run(async () => { await api(`/api/daily-roadmap/actions/${id}/defer`, { method: "POST", body: JSON.stringify({ preset }) }); })}
                onSkip={(id, reason) => run(async () => { await api(`/api/daily-roadmap/actions/${id}/skip`, { method: "POST", body: JSON.stringify({ reason }) }); })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.roadmap?.completed.length ? (
        <details className="mt-8" open>
          <summary className="cursor-pointer font-display text-lg">Completed Today</summary>
          <div className="mt-3 grid min-w-0 gap-3">
            {data.roadmap.completed.map((action) => (
              <ActionCard
                action={action}
                busy={busy}
                key={action.id}
                onComplete={() => undefined}
                onDefer={() => undefined}
                onSkip={() => undefined}
              />
            ))}
          </div>
        </details>
      ) : null}

      {data.roadmap?.deferred.length ? (
        <section className="mt-8">
          <h3 className="font-display text-lg">Deferred</h3>
          <div className="mt-3 grid min-w-0 gap-3">
            {data.roadmap.deferred.map((action) => (
              <ActionCard
                action={action}
                busy={busy}
                key={action.id}
                onComplete={() => undefined}
                onDefer={() => undefined}
                onSkip={() => undefined}
              />
            ))}
          </div>
        </section>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <form
            className="surface-glass w-full max-w-md overflow-y-auto p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await api("/api/daily-roadmap/preferences", {
                  method: "PATCH",
                  body: JSON.stringify(prefs),
                });
                setSettingsOpen(false);
              });
            }}
          >
            <h3 className="font-display text-lg">Today settings</h3>
            <label className="mt-4 block text-sm">
              Timezone
              <input
                className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2"
                onChange={(event) => setPrefs({ ...prefs, timezone: event.target.value })}
                value={prefs.timezone}
              />
            </label>
            <label className="mt-4 block text-sm">
              Daily minutes
              <input
                className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2"
                min={15}
                max={480}
                onChange={(event) => setPrefs({ ...prefs, dailyMinutesTarget: Number(event.target.value) })}
                type="number"
                value={prefs.dailyMinutesTarget}
              />
            </label>
            <label className="mt-4 block text-sm">
              Maximum core actions
              <input
                className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2"
                max={7}
                min={1}
                onChange={(event) => setPrefs({ ...prefs, maxCoreActions: Number(event.target.value) })}
                type="number"
                value={prefs.maxCoreActions}
              />
            </label>
            <fieldset className="mt-4">
              <legend className="text-sm">Active weekdays</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CAREER_WEEKDAYS.map((day) => {
                  const on = prefs.activeWeekdays.includes(day);
                  return (
                    <button
                      className={`rounded border px-2 py-1 text-xs ${on ? "border-[var(--color-champagne)]" : "border-[var(--color-border)]"}`}
                      key={day}
                      onClick={() =>
                        setPrefs({
                          ...prefs,
                          activeWeekdays: on
                            ? prefs.activeWeekdays.filter((item) => item !== day)
                            : [...prefs.activeWeekdays, day],
                        })
                      }
                      type="button"
                    >
                      {WEEKDAY_LABEL[day]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                checked={prefs.includeLinkedIn}
                onChange={(event) => setPrefs({ ...prefs, includeLinkedIn: event.target.checked })}
                type="checkbox"
              />
              Include LinkedIn
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                checked={prefs.includeSkillDevelopment}
                onChange={(event) => setPrefs({ ...prefs, includeSkillDevelopment: event.target.checked })}
                type="checkbox"
              />
              Include skill development
            </label>
            <div className="mt-5 flex gap-3">
              <button className="rounded border border-[var(--color-border)] px-3 py-2 text-sm" type="submit">
                Save
              </button>
              <button className="text-sm underline" onClick={() => setSettingsOpen(false)} type="button">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {customOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <form
            className="surface-glass w-full max-w-md p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await api("/api/daily-roadmap/actions", {
                  method: "POST",
                  body: JSON.stringify({
                    title: customTitle,
                    ...(customMinutes ? { estimatedMinutes: Number(customMinutes) } : {}),
                  }),
                });
                setCustomTitle("");
                setCustomMinutes("");
                setCustomOpen(false);
              });
            }}
          >
            <h3 className="font-display text-lg">Add Career Action</h3>
            <label className="mt-4 block text-sm">
              Title
              <input
                className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2"
                data-testid="custom-action-title"
                onChange={(event) => setCustomTitle(event.target.value)}
                value={customTitle}
              />
            </label>
            <label className="mt-4 block text-sm">
              Estimated time
              <select
                className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2"
                data-testid="custom-action-minutes"
                onChange={(event) => setCustomMinutes(event.target.value)}
                value={customMinutes}
              >
                <option value="">Optional</option>
                {ESTIMATED_MINUTE_BUCKETS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex gap-3">
              <button className="rounded border border-[var(--color-border)] px-3 py-2 text-sm" data-testid="custom-action-submit" type="submit">
                Add
              </button>
              <button className="text-sm underline" onClick={() => setCustomOpen(false)} type="button">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
