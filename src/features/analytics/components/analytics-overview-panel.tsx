import type { AnalyticsModuleData } from "../types";

type AnalyticsOverviewPanelProps = {
  data: AnalyticsModuleData;
};

function formatScore(value: number | null, suffix = "%"): string {
  if (value === null) return "—";
  return `${value}${suffix}`;
}

export function AnalyticsOverviewPanel({ data }: AnalyticsOverviewPanelProps) {
  const stats = [
    {
      label: "Resume completeness",
      value: formatScore(data.resume.completenessScore),
    },
    {
      label: "Detected skills",
      value: String(data.skills.detectedSkillsCount),
    },
    {
      label: "Saved jobs",
      value: String(data.jobs.savedJobsCount),
    },
    {
      label: "Average match",
      value: formatScore(data.jobs.averageMatchScore),
    },
    {
      label: "Skill coverage",
      value: formatScore(data.skills.skillCoverageScore),
    },
    {
      label: "Resume analyses",
      value: String(data.resume.resumeAnalysesCount),
    },
  ];

  return (
    <section
      aria-labelledby="analytics-overview-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="analytics-overview-heading"
      >
        Overview Metrics
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
