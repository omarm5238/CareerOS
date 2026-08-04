type AnalyticsRecommendationsPanelProps = {
  recommendations: string[];
};

export function AnalyticsRecommendationsPanel({
  recommendations,
}: AnalyticsRecommendationsPanelProps) {
  return (
    <section
      aria-labelledby="analytics-recommendations-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="analytics-recommendations-heading"
      >
        Recommendations
      </h2>

      {recommendations.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {recommendations.map((item) => (
            <li
              className="flex gap-2 text-sm leading-6 text-[var(--color-text-secondary)]"
              key={item}
            >
              <span aria-hidden="true" className="text-[var(--color-accent)]">
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          No recommendations available yet.
        </p>
      )}
    </section>
  );
}
