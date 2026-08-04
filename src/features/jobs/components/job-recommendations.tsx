type JobRecommendationsProps = {
  recommendations: string[];
};

export function JobRecommendations({ recommendations }: JobRecommendationsProps) {
  return (
    <section
      aria-labelledby="job-recommendations-heading"
      className="surface-glass p-5"
    >
      <h2
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]"
        id="job-recommendations-heading"
      >
        Recommendations
      </h2>

      {recommendations.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-text-primary)]">
          {recommendations.map((item) => (
            <li className="flex gap-2" key={item}>
              <span aria-hidden="true" className="text-[var(--color-accent)]">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No recommendations available for this job yet.
        </p>
      )}
    </section>
  );
}
