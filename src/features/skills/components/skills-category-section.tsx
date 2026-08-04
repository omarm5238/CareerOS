import { SKILL_CATEGORY_ORDER } from "../constants";
import type { GroupedSkills } from "../types";

type SkillsCategorySectionProps = {
  groupedSkills: GroupedSkills;
};

export function SkillsCategorySection({ groupedSkills }: SkillsCategorySectionProps) {
  const hasAnySkills = SKILL_CATEGORY_ORDER.some(
    (category) => groupedSkills[category].length > 0,
  );

  if (!hasAnySkills) return null;

  return (
    <section
      aria-labelledby="detected-skills-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="detected-skills-heading"
      >
        Detected Skills
      </h2>

      <div className="mt-4 space-y-5">
        {SKILL_CATEGORY_ORDER.map((category) => {
          const skills = groupedSkills[category];
          if (skills.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{category}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <li key={`${category}-${skill}`}>
                    <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]">
                      {skill}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
