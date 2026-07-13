const FEATURES = [
  {
    mark: "RS",
    title: "Resume Intelligence",
    description:
      "Extract role, experience, and skills from your resume to establish a structured career profile.",
  },
  {
    mark: "JB",
    title: "Job Matching",
    description:
      "Compare saved job postings against your profile and surface a clear match score for each role.",
  },
  {
    mark: "SK",
    title: "Skill Gap Mapping",
    description:
      "Identify missing skills between your resume and target jobs so you know what to develop next.",
  },
  {
    mark: "AN",
    title: "Application Tracking",
    description:
      "Track application status, readiness metrics, and career health from one operating view.",
  },
] as const;

export function FeatureCards() {
  return (
    <section className="scroll-mt-24 px-6 py-16 lg:px-8 lg:py-20" id="features">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-secondary)]">
            What CareerOS does
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            One workspace for resume, jobs, skills, and readiness.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl [transition:var(--motion-fade)] hover:border-[rgb(99_102_241_/_22%)]"
              key={feature.title}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[rgb(99_102_241_/_28%)] bg-[rgb(99_102_241_/_10%)] text-[10px] font-semibold tracking-[0.14em] text-[var(--color-accent)]">
                {feature.mark}
              </span>
              <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
