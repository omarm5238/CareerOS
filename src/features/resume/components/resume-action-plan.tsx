import type { ResumeActionItem, ResumeActionPriority } from "../types";

type ResumeActionPlanProps = {
  actions: ResumeActionItem[];
};

export function ResumeActionPlan({ actions }: ResumeActionPlanProps) {
  return (
    <section
      aria-labelledby="resume-action-plan-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-action-plan-heading"
      >
        Resume Action Plan
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        Prioritized next steps based on your current analysis.
      </p>

      {actions.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          No priority actions yet. Upload a more detailed resume to receive stronger
          recommendations.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {actions.map((action) => (
            <li
              className="surface-card p-4"
              key={action.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                  {action.title}
                </h3>
                <PriorityBadge priority={action.priority} />
              </div>

              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                {action.source}
              </p>

              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-text-primary)]">Reason: </span>
                {action.reason}
              </p>

              <p className="mt-2 text-sm leading-6 text-[var(--color-text-primary)]">
                <span className="text-[var(--color-text-secondary)]">Suggested fix: </span>
                {action.suggestedFix}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PriorityBadge({ priority }: { priority: ResumeActionPriority }) {
  const styles =
    priority === "High"
      ? "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]"
      : priority === "Medium"
        ? "border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_70%)] text-[var(--color-text-primary)]"
        : "border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] text-[var(--color-text-secondary)]";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${styles}`}
    >
      {priority}
    </span>
  );
}
