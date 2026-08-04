import type { SelectedTargetDeltaData } from "../insights/build-selected-target-delta";

type SelectedTargetDeltaProps = {
  delta: SelectedTargetDeltaData;
};

export function SelectedTargetDelta({ delta }: SelectedTargetDeltaProps) {
  return (
    <section
      aria-labelledby="selected-target-delta-heading"
      className="surface-premium p-5"
    >
      <h2 className="section-eyebrow" id="selected-target-delta-heading">
        Selected Target Delta
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        How this target job differs from a generic all-jobs view.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="section-eyebrow">Match score</dt>
          <dd className="metric-number mt-1 text-2xl text-[var(--color-text-primary)]">
            {delta.matchScore === null ? "Not analyzed yet" : `${delta.matchScore}%`}
          </dd>
        </div>
        <div>
          <dt className="section-eyebrow">Target</dt>
          <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
            {delta.jobTitle} · {delta.company}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="section-eyebrow">Missing technical skills</dt>
          <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
            {delta.missingTechnicalSkills.length > 0
              ? delta.missingTechnicalSkills.join(" · ")
              : "None detected"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="section-eyebrow">Non-skill blockers</dt>
          <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
            {delta.nonSkillBlockers.length > 0
              ? delta.nonSkillBlockers.join(" · ")
              : "None detected"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="section-eyebrow">Next move</dt>
          <dd className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
            {delta.nextMove}
          </dd>
        </div>
      </dl>
    </section>
  );
}
