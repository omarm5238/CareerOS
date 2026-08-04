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
        tone="success"
      />

      <InsightList
        emptyMessage="No improvement areas were identified yet."
        heading="Areas to strengthen"
        headingId="resume-weaknesses-heading"
        items={weaknesses}
        tone="warning"
      />

      <section
        aria-labelledby="resume-focus-heading"
        className="surface-glass p-5"
      >
        <h2 className="section-eyebrow" id="resume-focus-heading">
          Suggested Next Focus
        </h2>

        {suggestedFocus.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestedFocus.map((item) => (
              <li key={item}>
                <span className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1 text-xs text-[var(--color-text-primary)]">
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
  tone,
}: {
  heading: string;
  headingId: string;
  items: string[];
  emptyMessage: string;
  tone: "success" | "warning";
}) {
  const chipClass =
    tone === "success"
      ? "inline-flex rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2.5 py-1 text-xs text-[var(--status-success-text)]"
      : "inline-flex rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2.5 py-1 text-xs text-[var(--status-warning-text)]";

  return (
    <section
      aria-labelledby={headingId}
      className="surface-glass p-5"
    >
      <h2 className="section-eyebrow" id={headingId}>
        {heading}
      </h2>

      {items.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item}>
              <span className={chipClass}>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>
      )}
    </section>
  );
}
