import type { SkillsOverview } from "../types";

export function RequirementsAndProjectsPanel({
  overview,
  selectedJobMode = false,
}: {
  overview: SkillsOverview;
  selectedJobMode?: boolean;
}) {
  const groups = [
    { title: "Experience / Eligibility Gaps", items: overview.experienceGaps },
    { title: "Proof / Evidence Gaps", items: overview.evidenceGaps },
    { title: "Role Context Notes", items: overview.contextRequirements },
  ];
  return (
    <div className="space-y-6">
      {groups.some((group) => group.items.length > 0) ? (
        <section className="surface-glass p-5">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
            Non-skill requirements
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {selectedJobMode
              ? "Selected-job live guidance — experience, proof, and role context only."
              : "Aggregated across all saved jobs."}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                  {group.title}
                </h3>
                {group.items.length ? (
                  <ul className="mt-2 space-y-1">
                    {group.items.map((item) => (
                      <li className="text-sm text-[var(--color-text-secondary)]" key={item}>
                        <span className="mr-2 text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                          {group.title.startsWith("Experience")
                            ? "Eligibility constraint"
                            : group.title.startsWith("Proof")
                              ? "Proof needed"
                              : "Evidence needed"}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">None detected.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {overview.projectIdeas.length > 0 ? (
        <section className="surface-glass p-5">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
            Contextual Project Ideas
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {selectedJobMode ? "Selected-job live guidance" : overview.sourceLabel}
          </p>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {overview.projectIdeas.map((idea) => (
              <li
                className="surface-card p-4"
                key={idea.title}
              >
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{idea.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{idea.description}</p>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  Skills proved: {idea.skillsProved.join(", ") || "Evidence quality"}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Output: {idea.outputArtifact}
                </p>
                {idea.estimatedEffort &&
                !/evidence gap|context requirement|portfolio proof/i.test(idea.estimatedEffort) ? (
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Estimated effort: {idea.estimatedEffort}
                  </p>
                ) : idea.estimatedEffort ? (
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {idea.estimatedEffort}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{idea.whyThisHelps}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
