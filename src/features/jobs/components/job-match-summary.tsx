import { formatAnalyzedDate } from "@/features/resume/lib/format-resume-display";
import { partitionRequirements } from "@/features/shared/insights";

import type { RoleAlignment } from "../types";

type JobMatchSummaryProps = {
  matchScore: number;
  roleAlignment: RoleAlignment;
  matchedSkills: string[];
  missingSkills: string[];
};

export function JobMatchSummary({
  matchScore,
  roleAlignment,
  matchedSkills,
  missingSkills,
}: JobMatchSummaryProps) {
  const requirements = partitionRequirements(missingSkills);
  return (
    <section
      aria-labelledby="job-match-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="job-match-heading"
      >
        Match Summary
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="surface-card p-3">
          <p className="section-eyebrow">Match score</p>
          <p className="metric-number mt-1 text-3xl text-[var(--color-text-primary)]">
            {matchScore}%
            <span className="sr-only"> match</span>
          </p>
        </div>
        <div className="surface-card p-3">
          <p className="text-[11px] text-[var(--color-text-secondary)]">Role alignment</p>
          <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
            {roleAlignment}
          </p>
        </div>
      </div>

      <SkillGroup label="Matched skills" skills={matchedSkills} empty="No matched skills yet." />
      <SkillGroup label="Missing skills" skills={requirements.skill} empty="No missing technical skills." />
      <SkillGroup
        label="Experience gaps"
        skills={requirements.experience_gap}
        empty=""
      />
      <SkillGroup
        label="Proof / evidence gaps"
        skills={requirements.evidence_gap}
        empty=""
      />
      <SkillGroup
        label="Role requirements"
        skills={requirements.context_requirement}
        empty=""
      />
    </section>
  );
}

function SkillGroup({
  label,
  skills,
  empty,
}: {
  label: string;
  skills: string[];
  empty: string;
}) {
  return (
    skills.length === 0 && !empty ? null :
    <div className="mt-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        {label}
      </p>
      {skills.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill}>
              <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]">
                {skill}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{empty}</p>
      )}
    </div>
  );
}

export function formatJobCreatedAt(iso: string): string {
  return formatAnalyzedDate(iso);
}
