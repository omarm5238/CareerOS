import type { SkillsOverview } from "../types";

type SkillsOverviewPanelProps = {
  overview: SkillsOverview;
};

export function SkillsOverviewPanel({ overview }: SkillsOverviewPanelProps) {
  const stats = [
    { label: "Detected skills", value: overview.detectedSkills.length },
    { label: "Categories", value: overview.categoryCount },
    { label: "Jobs analyzed", value: overview.savedJobsAnalyzedCount },
    { label: "Coverage score", value: `${overview.skillCoverageScore}%` },
  ];

  return (
    <section
      aria-labelledby="skills-overview-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="skills-overview-heading"
      >
        Skills Overview
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            className="surface-card p-3"
            key={stat.label}
          >
            <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              {stat.label}
            </dt>
            <dd className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
