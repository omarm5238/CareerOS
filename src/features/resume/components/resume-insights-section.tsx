type ResumeInsightsSectionProps = {
  strengths: string[];
  weaknesses: string[];
  suggestedFocus: string[];
};

export function ResumeInsightsSection({
  strengths,
  weaknesses,
  suggestedFocus,
}: ResumeInsightsSectionProps) {
  return (
    <div className="space-y-4">
      <InsightList
        emptyMessage="No strengths were identified yet."
        heading="Strengths"
        headingId="resume-strengths-heading"
        items={strengths}
      />

      <InsightList
        emptyMessage="No improvement areas were identified yet."
        heading="Areas to strengthen"
        headingId="resume-weaknesses-heading"
        items={weaknesses}
      />

      <section
        aria-labelledby="resume-focus-heading"
        className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
      >
        <h2
          className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
          id="resume-focus-heading"
        >
          Suggested Next Focus
        </h2>

        {suggestedFocus.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestedFocus.map((item) => (
              <li key={item}>
                <span className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_70%)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            No focus areas were suggested in the latest analysis.
          </p>
        )}
      </section>
    </div>
  );
}

function InsightList({
  heading,
  headingId,
  items,
  emptyMessage,
}: {
  heading: string;
  headingId: string;
  items: string[];
  emptyMessage: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id={headingId}
      >
        {heading}
      </h2>

      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-text-primary)]">
          {items.map((item) => (
            <li className="flex gap-2" key={item}>
              <span aria-hidden="true" className="text-[var(--color-accent)]">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>
      )}
    </section>
  );
}
