import type { CareerHealthResult } from "../types";

type CareerHealthPanelProps = {
  careerHealth: CareerHealthResult;
};

const labelStyles: Record<CareerHealthResult["label"], string> = {
  Strong: "border-[rgb(34_197_94_/_35%)] bg-[rgb(34_197_94_/_8%)] text-[rgb(134_239_172)]",
  Developing: "border-[rgb(99_102_241_/_35%)] bg-[rgb(99_102_241_/_8%)] text-[rgb(165_180_252)]",
  "Needs Work": "border-[rgb(245_158_11_/_35%)] bg-[rgb(245_158_11_/_8%)] text-[rgb(253_230_138)]",
  "Not Enough Data":
    "border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_70%)] text-[var(--color-text-secondary)]",
};

export function CareerHealthPanel({ careerHealth }: CareerHealthPanelProps) {
  return (
    <section
      aria-labelledby="career-health-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="career-health-heading"
      >
        Career Health
      </h2>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-[var(--color-text-primary)]">
            {careerHealth.score}
            <span className="text-lg text-[var(--color-text-secondary)]">/100</span>
          </p>
          <span
            className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${labelStyles[careerHealth.label]}`}
          >
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
          className="h-2 overflow-hidden rounded-full bg-[rgb(10_10_10_/_80%)]"
        >
          <div
            className="h-full rounded-full bg-[var(--color-accent)] [transition:var(--motion-fade)]"
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
