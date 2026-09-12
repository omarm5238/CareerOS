import type { LinkedinIdeaView, LinkedinInsightView, LinkedinVisibilityGap } from "../types";
import type { LinkedinOverviewView } from "../types";
import { LinkedinActionButton } from "./linkedin-actions";
import { LinkedinSubNav } from "./linkedin-sub-nav";

export function LinkedinInsightsPage({
  insights,
  next,
  gaps,
  overview,
}: {
  insights: LinkedinInsightView[];
  next: LinkedinIdeaView[];
  gaps: LinkedinVisibilityGap[];
  overview: LinkedinOverviewView;
}) {
  return (
    <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
      <LinkedinSubNav />
      <p className="mt-6 text-sm text-[var(--color-text-secondary)]">
        Metrics are manual until M25B. CareerOS does not fetch LinkedIn analytics automatically.
      </p>
      <div className="mt-4 max-w-xs">
        <LinkedinActionButton label="Generate insights" href="/api/linkedin/insights/generate" />
      </div>
      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">What should you post next?</p>
        <ul className="mt-3 space-y-2 text-sm">
          {next.map((idea) => (
            <li key={idea.id}>
              <strong>{idea.title}</strong> — {idea.why}
            </li>
          ))}
        </ul>
      </section>
      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">Visibility gaps</p>
        <ul className="mt-3 space-y-2 text-sm">
          {gaps.map((gap) => (
            <li key={gap.topic}>{gap.reason}</li>
          ))}
        </ul>
      </section>
      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">Recent performance</p>
        <ul className="mt-3 space-y-2 text-sm">
          {overview.recentPerformance.length === 0 ? (
            <li>No manual snapshots yet.</li>
          ) : (
            overview.recentPerformance.map((item) => (
              <li key={item.id}>
                {item.capturedAt} · impressions {item.impressions ?? "unknown"} · engagement rate{" "}
                {item.engagementRate ?? "n/a"}
              </li>
            ))
          )}
        </ul>
      </section>
      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">Growth insights</p>
        <ul className="mt-3 space-y-3">
          {insights.map((insight) => (
            <li key={insight.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
              <p className="text-sm font-medium">{insight.title}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{insight.summary}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em]">{insight.confidence}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
