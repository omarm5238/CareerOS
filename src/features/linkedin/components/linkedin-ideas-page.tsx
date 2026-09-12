import type { LinkedinIdeaView, LinkedinVisibilityGap } from "../types";
import { LinkedinActionButton } from "./linkedin-actions";
import { LinkedinSubNav } from "./linkedin-sub-nav";

export function LinkedinIdeasPage({
  ideas,
  recommendations,
  gaps,
}: {
  ideas: LinkedinIdeaView[];
  recommendations: LinkedinIdeaView[];
  gaps: LinkedinVisibilityGap[];
}) {
  return (
    <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
      <LinkedinSubNav />
      <div className="mt-6 flex flex-wrap gap-2">
        <LinkedinActionButton label="Generate ideas" href="/api/linkedin/ideas/generate" body={{ count: 5 }} />
      </div>
      <section className="surface-glass mt-6 p-5">
        <p className="section-eyebrow">What should you post next?</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {recommendations.map((idea) => (
            <article key={idea.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
              <h3 className="text-sm font-medium">{idea.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{idea.why}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">Visibility gaps</p>
        <ul className="mt-3 space-y-2 text-sm">
          {gaps.map((gap) => (
            <li key={gap.topic}>
              <strong>{gap.topic}</strong> — {gap.reason}
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-4 grid gap-4">
        {ideas.map((idea) => (
          <article key={idea.id} className="surface-glass p-5">
            <p className="section-eyebrow">{idea.pillarName ?? "Unassigned"} · {idea.format}</p>
            <h3 className="mt-2 font-display text-lg">{idea.title}</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{idea.summary}</p>
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              Content Priority {idea.priorityScore} · Evidence {idea.evidenceStrength} · Recruiter {idea.recruiterRelevance}
            </p>
            <p className="mt-2 text-sm">Why this idea: {idea.why}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <LinkedinActionButton label="Shortlist" href={`/api/linkedin/ideas/${idea.id}`} method="PATCH" body={{ status: "SHORTLISTED" }} />
              <LinkedinActionButton label="Draft" href={`/api/linkedin/ideas/${idea.id}/draft`} redirectTo="/workspace/linkedin/posts/[id]" />
              <LinkedinActionButton label="Dismiss" href={`/api/linkedin/ideas/${idea.id}`} method="PATCH" body={{ status: "DISMISSED" }} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
