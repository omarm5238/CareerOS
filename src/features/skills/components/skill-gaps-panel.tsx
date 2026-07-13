import Link from "next/link";

type SkillGapsPanelProps = {
  missingSkills: string[];
  missingSkillJobCounts: Record<string, number>;
  hasJobs: boolean;
};

function resolveJobCount(
  skill: string,
  counts: Record<string, number>,
): number {
  return counts[skill.toLowerCase()] ?? 1;
}

export function SkillGapsPanel({
  missingSkills,
  missingSkillJobCounts,
  hasJobs,
}: SkillGapsPanelProps) {
  return (
    <section
      aria-labelledby="skill-gaps-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="skill-gaps-heading"
      >
        Job Skill Gaps
      </h2>

      {!hasJobs ? (
        <div className="mt-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Add saved jobs to discover market-driven skill gaps.
          </p>
          <Link
            className="mt-3 inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/workspace/jobs"
          >
            Go to Jobs module
          </Link>
        </div>
      ) : missingSkills.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {missingSkills.map((skill) => {
            const count = resolveJobCount(skill, missingSkillJobCounts);
            return (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] px-3 py-2"
                key={skill}
              >
                <span className="text-sm text-[var(--color-text-primary)]">{skill}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Missing in {count} saved {count === 1 ? "job" : "jobs"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          No skill gaps detected across your saved jobs. Your resume covers the required skills.
        </p>
      )}
    </section>
  );
}
