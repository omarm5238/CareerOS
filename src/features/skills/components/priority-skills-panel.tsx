import type { PrioritySkillItem } from "../types";

type PrioritySkillsPanelProps = {
  items: PrioritySkillItem[];
};

const priorityStyles: Record<PrioritySkillItem["priority"], string> = {
  High: "border-[rgb(239_68_68_/_35%)] bg-[rgb(239_68_68_/_8%)] text-[rgb(252_165_165)]",
  Medium: "border-[rgb(245_158_11_/_35%)] bg-[rgb(245_158_11_/_8%)] text-[rgb(253_230_138)]",
  Low: "border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_70%)] text-[var(--color-text-secondary)]",
};

export function PrioritySkillsPanel({ items }: PrioritySkillsPanelProps) {
  return (
    <section
      aria-labelledby="priority-skills-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="priority-skills-heading"
      >
        Priority Skills
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Top skills to improve next based on your resume and saved jobs.
      </p>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_68%)] p-4"
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
