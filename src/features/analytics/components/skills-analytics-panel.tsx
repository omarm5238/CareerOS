import Link from "next/link";

import type { AnalyticsSkillsMetrics } from "../types";

type SkillsAnalyticsPanelProps = {
  skills: AnalyticsSkillsMetrics;
};

function formatScore(value: number | null): string {
  if (value === null) return "—";
  return `${value}%`;
}

export function SkillsAnalyticsPanel({ skills }: SkillsAnalyticsPanelProps) {
  return (
    <section
      aria-labelledby="skills-analytics-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="skills-analytics-heading"
      >
        Skills Analytics
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricItem label="Detected skills" value={String(skills.detectedSkillsCount)} />
        <MetricItem label="Skill gaps" value={String(skills.gapsCount)} />
        <MetricItem label="Priority skills" value={String(skills.prioritySkillsCount)} />
        <MetricItem label="Skill coverage" value={formatScore(skills.skillCoverageScore)} />
      </dl>

      {skills.topPrioritySkills.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            Top priority skills
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {skills.topPrioritySkills.map((skill) => (
              <li key={skill}>
                <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_70%)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]">
                  {skill}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          No priority skills identified yet.
        </p>
      )}

      <Link
        className="mt-4 inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        href="/workspace/skills"
      >
        View Skills module
      </Link>
    </section>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-3">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
