import type { LinkedinStrategyView } from "../types";
import { LinkedinActionButton } from "./linkedin-actions";
import { LinkedinSubNav } from "./linkedin-sub-nav";

export function LinkedinStrategyPage({ strategy }: { strategy: LinkedinStrategyView | null }) {
  return (
    <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
      <LinkedinSubNav />
      {!strategy ? (
        <div className="mx-auto mt-16 max-w-xl text-center">
          <h2 className="font-display text-2xl">Build your LinkedIn growth strategy</h2>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            CareerOS uses verified career context to create a focused professional content strategy.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <LinkedinActionButton label="Create Strategy" href="/api/linkedin/strategy" />
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <section className="surface-glass p-5">
            <p className="section-eyebrow">Strategy · {strategy.status}</p>
            <h2 className="mt-2 font-display text-xl">Primary goal</h2>
            <p className="mt-1">{strategy.primaryGoal.replaceAll("_", " ")}</p>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{strategy.positioningStatement}</p>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div><dt className="text-[var(--color-text-secondary)]">Tone</dt><dd>{strategy.contentTone}</dd></div>
              <div><dt className="text-[var(--color-text-secondary)]">Language</dt><dd>{strategy.preferredLanguage}</dd></div>
              <div><dt className="text-[var(--color-text-secondary)]">Posting frequency</dt><dd>{strategy.postingFrequencyTarget ?? "—"} / week</dd></div>
              <div><dt className="text-[var(--color-text-secondary)]">Target roles</dt><dd>{strategy.targetRoleTitles.join(", ") || "—"}</dd></div>
              <div className="md:col-span-2"><dt className="text-[var(--color-text-secondary)]">Audience</dt><dd>{strategy.targetAudience.join(", ") || "—"}</dd></div>
              <div className="md:col-span-2"><dt className="text-[var(--color-text-secondary)]">Secondary goals</dt><dd>{strategy.secondaryGoals.join(", ") || "—"}</dd></div>
            </dl>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {strategy.status !== "ACTIVE" ? (
                <LinkedinActionButton label="Activate" href="/api/linkedin/strategy/activate" body={{ id: strategy.id }} />
              ) : null}
              <LinkedinActionButton label="Refresh" href="/api/linkedin/strategy/refresh" />
              <LinkedinActionButton
                label="Edit draft goal"
                href="/api/linkedin/strategy"
                method="PATCH"
                body={{ id: strategy.id, postingFrequencyTarget: strategy.postingFrequencyTarget ?? 2 }}
              />
            </div>
          </section>
          <section className="surface-glass p-5">
            <p className="section-eyebrow">Content pillars</p>
            <ul className="mt-3 space-y-3">
              {strategy.pillars.map((pillar) => (
                <li key={pillar.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
                  <p className="text-sm font-medium">{pillar.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{pillar.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                    {pillar.priority}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
