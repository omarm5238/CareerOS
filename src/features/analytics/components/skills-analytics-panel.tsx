import Link from "next/link";

import { ZERO_JOBS_UNLOCK_MESSAGE } from "@/features/shared/insights";

import type { AnalyticsSkillsMetrics } from "../types";

type SkillsAnalyticsPanelProps = {
  skills: AnalyticsSkillsMetrics;
  savedJobsCount: number;
};

function formatScore(value: number | null): string {
  if (value === null) return "—";
  return `${value}%`;
}

export function SkillsAnalyticsPanel({ skills, savedJobsCount }: SkillsAnalyticsPanelProps) {
  const needsJob = savedJobsCount === 0;

  return (
    <section
      aria-labelledby="skills-analytics-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="skills-analytics-heading"
      >
        Skills Analytics
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricItem label="Detected skills" value={String(skills.detectedSkillsCount)} />
        <MetricItem label="Skill gaps" value={needsJob ? "0" : String(skills.gapsCount)} />
        <MetricItem
          label="Priority skills"
          value={needsJob ? "0" : String(skills.prioritySkillsCount)}
        />
        <MetricItem label="Skill coverage" value={formatScore(skills.skillCoverageScore)} />
        <MetricItem
          label="Skills strategy"
          value={
            needsJob
              ? "Needs target job"
              : skills.skillsInsightSource === "ai"
                ? savedJobsCount > 1
                  ? "AI · all saved jobs"
                  : "AI"
                : skills.skillsInsightSource === "rule_based"
                  ? "Rule-based"
                  : "—"
          }
        />
        <MetricItem
          label="Strategy generated"
          value={
            !needsJob && skills.skillsInsightGeneratedAt
              ? new Date(skills.skillsInsightGeneratedAt).toLocaleDateString()
              : "—"
          }
        />
      </dl>

      {!needsJob && skills.topPrioritySkills.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            Top priority skills
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {skills.topPrioritySkills.map((skill) => (
              <li key={skill}>
                <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]">
                  {skill}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          {needsJob
            ? `No priority skills identified yet. ${ZERO_JOBS_UNLOCK_MESSAGE}`
            : "No priority skills identified yet."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-4">
        <Link
          className="inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          href="/workspace/skills"
        >
          View Skills module
        </Link>
        {needsJob ? (
          <Link
            className="inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/workspace/jobs"
          >
            View Jobs module
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-3">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
