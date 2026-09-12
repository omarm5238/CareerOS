import Link from "next/link";

import type { LinkedinOverviewView } from "../types";
import { LinkedinActionButton } from "./linkedin-actions";
import { LinkedinSubNav } from "./linkedin-sub-nav";

export function LinkedinOverviewPage({ data }: { data: LinkedinOverviewView }) {
  if (!data.strategy) {
    return (
      <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
        <LinkedinSubNav />
        <div className="mx-auto mt-16 max-w-xl text-center">
          <p className="section-eyebrow">LinkedIn</p>
          <h2 className="mt-3 font-display text-2xl">Build your LinkedIn growth strategy</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
            CareerOS uses verified career context to create a focused professional content strategy.
            Nothing is posted to LinkedIn from this module.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <LinkedinActionButton label="Create Strategy" href="/api/linkedin/strategy" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
      <LinkedinSubNav />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="surface-glass p-5">
          <p className="section-eyebrow">Active strategy</p>
          <h2 className="mt-2 font-display text-xl">{data.strategy.primaryGoal.replaceAll("_", " ")}</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{data.strategy.positioningStatement}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            {data.strategy.status}
          </p>
        </section>
        <section className="surface-glass p-5">
          <p className="section-eyebrow">This month</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt>Ready drafts</dt><dd>{data.readyDraftCount}</dd></div>
            <div className="flex justify-between gap-3"><dt>Publishing queue</dt><dd>{data.scheduledCount}</dd></div>
            <div className="flex justify-between gap-3"><dt>Posts this month</dt><dd>{data.publishedThisMonth}</dd></div>
          </dl>
        </section>
        <section className="surface-glass p-5">
          <p className="section-eyebrow">Active pillars</p>
          <ul className="mt-3 space-y-2 text-sm">
            {data.strategy.pillars.map((pillar) => (
              <li key={pillar.id}>{pillar.name} · {pillar.priority}</li>
            ))}
          </ul>
        </section>
        <section className="surface-glass p-5">
          <p className="section-eyebrow">What should you post next?</p>
          {data.nextRecommendation ? (
            <>
              <h3 className="mt-2 text-base">{data.nextRecommendation.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{data.nextRecommendation.why}</p>
              <Link className="mt-3 inline-block text-sm underline" href="/workspace/linkedin/ideas">
                Open ideas
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Generate ideas after your strategy is active.</p>
          )}
        </section>
        <section className="surface-glass p-5 md:col-span-2">
          <p className="section-eyebrow">Visibility gaps</p>
          <ul className="mt-3 space-y-2 text-sm">
            {data.visibilityGaps.length === 0 ? (
              <li className="text-[var(--color-text-secondary)]">No visibility gaps yet.</li>
            ) : (
              data.visibilityGaps.map((gap) => (
                <li key={gap.topic}>
                  <strong>{gap.topic}</strong> — {gap.reason}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
