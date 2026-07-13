const STEPS = [
  {
    step: "01",
    title: "Upload your resume",
    description: "CareerOS parses your resume and builds a baseline profile with detected skills.",
  },
  {
    step: "02",
    title: "Save jobs you care about",
    description: "Add job postings to your pipeline and compare each role against your profile.",
  },
  {
    step: "03",
    title: "See your readiness map",
    description:
      "Review match scores, missing skills, application status, and career readiness in one view.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      className="scroll-mt-24 border-y border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_42%)] px-6 py-16 lg:px-8 lg:py-20"
      id="how-it-works"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-secondary)]">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            From resume upload to career readiness in three steps.
          </h2>
        </div>

        <ol className="mt-10 grid gap-4 lg:grid-cols-3">
          {STEPS.map((item) => (
            <li
              className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_52%)] p-5"
              key={item.step}
            >
              <span className="text-xs font-medium tracking-[0.2em] text-[var(--color-accent)]">
                {item.step}
              </span>
              <h3 className="mt-3 text-lg font-medium text-[var(--color-text-primary)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
