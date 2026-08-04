import type { CareerHealthResult } from "../types";

type CareerHealthPanelProps = {
  careerHealth: CareerHealthResult;
};

const labelStyles: Record<CareerHealthResult["label"], string> = {
  Strong: "status-chip status-chip--success",
  Developing: "status-chip status-chip--info",
  "Needs Work": "status-chip status-chip--warning",
  "Not Enough Data": "status-chip status-chip--neutral",
};

export function CareerHealthPanel({ careerHealth }: CareerHealthPanelProps) {
  return (
    <section
      aria-labelledby="career-health-heading"
      className="surface-glass p-5"
    >
      <h2
        className="section-eyebrow"
        id="career-health-heading"
      >
        Career Health
      </h2>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="metric-number text-[var(--color-text-primary)]">
            {careerHealth.score}
            <span className="text-lg font-medium text-[var(--color-text-secondary)]">/100</span>
          </p>
          <span className={`mt-2 ${labelStyles[careerHealth.label]}`}>
            {careerHealth.label}
          </span>
        </div>
        <p className="max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">
          {careerHealth.explanation}
        </p>
      </div>

      <div className="mt-5">
        <div
          aria-hidden="true"
          className="progress-track h-2"
        >
          <div
            className="progress-fill [transition:var(--motion-fade)]"
            style={{ width: `${careerHealth.score}%` }}
          />
        </div>
        <p className="sr-only">
          Career health score: {careerHealth.score} out of 100. Status: {careerHealth.label}.
        </p>
      </div>
    </section>
  );
}
