import Link from "next/link";

type SkillsEmptyStateProps = {
  variant: "no-resume" | "no-detected-skills";
};

export function SkillsEmptyState({ variant }: SkillsEmptyStateProps) {
  if (variant === "no-resume") {
    return (
      <div className="relative mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
            Skills Module
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            No resume skills yet
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
            Upload a resume to detect skills and compare them against saved jobs.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            className="inline-flex rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-accent-glow)] [transition:var(--motion-fade)] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/onboarding"
          >
            Upload resume
          </Link>
          <Link
            className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/workspace"
          >
            Back to Workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="no-detected-skills-heading"
      className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] p-5 backdrop-blur-xl"
    >
      <h2
        className="text-lg font-semibold text-[var(--color-text-primary)]"
        id="no-detected-skills-heading"
      >
        No detected skills found
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        Your resume analysis did not surface explicit skills. Try uploading a more detailed resume
        with a dedicated skills section.
      </p>
      <Link
        className="mt-4 inline-flex text-sm text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        href="/onboarding"
      >
        Upload a more detailed resume
      </Link>
    </section>
  );
}
