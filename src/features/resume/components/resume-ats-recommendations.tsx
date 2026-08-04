type ResumeAtsRecommendationsProps = {
  recommendations: string[];
};

export function ResumeAtsRecommendations({ recommendations }: ResumeAtsRecommendationsProps) {
  return (
    <section
      aria-labelledby="resume-ats-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="resume-ats-heading"
      >
        ATS Recommendations
      </h2>

      {recommendations.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {recommendations.map((item) => (
            <li
              className="flex items-start gap-3 surface-card px-3 py-3 text-sm leading-6 text-[var(--color-text-primary)]"
              key={item}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--color-border-subtle)] text-[10px] text-[var(--color-accent)]"
              >
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No ATS recommendations were generated for this analysis.
        </p>
      )}
    </section>
  );
}
