import type { SelectedTargetDeltaData } from "../insights/build-selected-target-delta";

type SelectedTargetDeltaProps = {
  delta: SelectedTargetDeltaData;
};

export function SelectedTargetDelta({ delta }: SelectedTargetDeltaProps) {
  return (
    <section
      aria-labelledby="selected-target-delta-heading"
      className="rounded-[var(--radius-xl)] border border-[rgb(99_102_241_/_28%)] bg-[rgb(99_102_241_/_8%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="selected-target-delta-heading"
      >
        Selected Target Delta
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        How this target job differs from a generic all-jobs view.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
            Match score
          </dt>
          <dd className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
            {delta.matchScore === null ? "Not analyzed yet" : `${delta.matchScore}%`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
            Target
          </dt>
          <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
            {delta.jobTitle} · {delta.company}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
            Missing technical skills
          </dt>
          <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
            {delta.missingTechnicalSkills.length > 0
              ? delta.missingTechnicalSkills.join(" · ")
              : "None detected"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
            Non-skill blockers
          </dt>
          <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
            {delta.nonSkillBlockers.length > 0
              ? delta.nonSkillBlockers.join(" · ")
              : "None detected"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
            Next move
          </dt>
          <dd className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
            {delta.nextMove}
          </dd>
        </div>
      </dl>
    </section>
  );
}
