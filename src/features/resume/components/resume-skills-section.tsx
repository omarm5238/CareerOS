type ResumeSkillsSectionProps = {
  skills: string[];
};

export function ResumeSkillsSection({ skills }: ResumeSkillsSectionProps) {
  return (
    <section
      aria-labelledby="resume-skills-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-skills-heading"
      >
        Skills
      </h2>

      {skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill}>
              <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_70%)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]">
                {skill}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No skills were detected in the latest analysis.
        </p>
      )}
    </section>
  );
}
