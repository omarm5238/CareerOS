import type { PrioritySkillItem } from "../types";

type PrioritySkillsPanelProps = {
  items: PrioritySkillItem[];
  selectedJobTitle?: string | null;
};

const priorityStyles: Record<PrioritySkillItem["priority"], string> = {
  High: "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  Medium: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  Low: "border-[var(--color-border-subtle)] bg-[var(--surface-inset)] text-[var(--color-text-secondary)]",
};

export function PrioritySkillsPanel({ items, selectedJobTitle }: PrioritySkillsPanelProps) {
  return (
    <section
      aria-labelledby="priority-skills-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="priority-skills-heading"
      >
        Priority Skills
      </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {selectedJobTitle
              ? `Missing for selected target job: ${selectedJobTitle}.`
              : "Repeated technical skills to improve across all saved jobs."}
          </p>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              className="surface-card p-4"
              key={item.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                  {item.skill}
                </h3>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${priorityStyles[item.priority]}`}
                >
                  {item.priority}
                </span>
              </div>
              <p className="mt-2 text-sm leading-5 text-[var(--color-text-secondary)]">
                {item.reason}
              </p>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                {item.demandSignal}
              </p>
              {item.estimatedEffort ? (
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Estimated effort: {item.estimatedEffort}
                  {item.effortRationale ? ` · ${item.effortRationale}` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          No priority skills identified yet. Add saved jobs or expand your resume to generate
          recommendations.
        </p>
      )}
    </section>
  );
}
