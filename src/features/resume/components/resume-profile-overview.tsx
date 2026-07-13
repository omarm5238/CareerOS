import type { ResumeModuleAnalysis } from "../types";

type ResumeProfileOverviewProps = {
  analysis: ResumeModuleAnalysis;
};

export function ResumeProfileOverview({ analysis }: ResumeProfileOverviewProps) {
  return (
    <section
      aria-labelledby="resume-profile-overview-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-profile-overview-heading"
      >
        Profile Overview
      </h2>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OverviewItem label="Detected role" value={analysis.role} />
        <OverviewItem label="Experience level" value={analysis.experienceLevel} />
        <OverviewItem
          label="Profile completeness"
          value={`${analysis.completenessScore}%`}
        />
        <OverviewItem
          label="Detected skills"
          value={String(analysis.detectedSkills.length)}
        />
      </dl>
    </section>
  );
}

function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-3">
      <dt className="text-[11px] text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
