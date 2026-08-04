import type { CareerExecutionPlan } from "../types/execution-plan";
import { groupCareerPlanWeeks } from "../lib/group-career-plan-weeks";

type CareerExecutionPlanPanelProps = {
  plan: CareerExecutionPlan | null;
};

function typeBadgeClass(): string {
  return "inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_55%)] px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)]";
}

export function CareerExecutionPlanPanel({ plan }: CareerExecutionPlanPanelProps) {
  if (!plan || plan.days.length === 0) {
    return (
      <section
        aria-labelledby="execution-plan-heading"
        className="surface-glass p-5"
        id="execution-plan"
      >
        <h2
          className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
          id="execution-plan-heading"
        >
          30-Day Career Execution Plan
        </h2>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Generate a CareerOS Brief to build a dated 30-day plan with estimated study hours.
        </p>
      </section>
    );
  }

  const weeks = groupCareerPlanWeeks(plan);

  return (
    <section
      aria-labelledby="execution-plan-heading"
      className="surface-glass p-5"
      id="execution-plan"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="execution-plan-heading"
      >
        30-Day Career Execution Plan
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {plan.startDate} → {plan.endDate} · ~{plan.totalEstimatedHours} estimated hours
      </p>

      <div className="mt-5 space-y-6">
        {weeks.map((week, index) => (
          <div key={week.summary?.week ?? `week-${index}`}>
            <div className="mb-3">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                {week.summary?.week ?? `Week ${index + 1}`}
              </h3>
              {week.summary ? (
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Focus: {week.summary.focus} · Outcome: {week.summary.outcome} · ~
                  {week.summary.totalHours}h
                </p>
              ) : null}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {week.days.map((day) => (
                <li
                  className="surface-card p-3"
                  key={`${day.date}-${day.dayNumber}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      Day {day.dayNumber} · {day.displayDate}
                    </span>
                    <span className={typeBadgeClass()}>{day.taskType}</span>
                    <span className="text-[11px] text-[var(--color-text-secondary)]">
                      {day.estimatedHours}h
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">
                    {day.taskTitle}
                  </p>
                  {day.taskDetails ? (
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {day.taskDetails}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Output: {day.outcome}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
