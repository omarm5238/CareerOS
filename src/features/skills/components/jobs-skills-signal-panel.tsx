type JobsSkillsSignalPanelProps = {
  matchedSkills: string[];
  missingSkills: string[];
  hasJobs: boolean;
};

function SkillChipList({ skills, variant }: { skills: string[]; variant: "matched" | "missing" }) {
  if (skills.length === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {variant === "matched" ? "No matched skills yet." : "No missing skills yet."}
      </p>
    );
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {skills.map((skill) => (
        <li key={`${variant}-${skill}`}>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${
              variant === "matched"
                ? "border-[rgb(34_197_94_/_30%)] bg-[rgb(34_197_94_/_8%)] text-[rgb(134_239_172)]"
                : "border-[rgb(239_68_68_/_30%)] bg-[rgb(239_68_68_/_8%)] text-[rgb(252_165_165)]"
            }`}
          >
            {skill}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function JobsSkillsSignalPanel({
  matchedSkills,
  missingSkills,
  hasJobs,
}: JobsSkillsSignalPanelProps) {
  return (
    <section
      aria-labelledby="job-skill-signals-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="job-skill-signals-heading"
      >
        Job Skill Signals
      </h2>

      {!hasJobs ? (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          Save jobs to compare matched and missing skills against your resume profile.
        </p>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Matched from jobs
            </h3>
            <SkillChipList skills={matchedSkills} variant="matched" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Missing from jobs
            </h3>
            <SkillChipList skills={missingSkills} variant="missing" />
          </div>
        </div>
      )}
    </section>
  );
}
