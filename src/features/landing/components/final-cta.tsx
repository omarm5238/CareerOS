import Link from "next/link";

export function FinalCta() {
  return (
    <section className="px-6 py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="surface-premium px-6 py-12 text-center sm:px-10 sm:py-14">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
            Build your career operating system.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
            Start with your resume, add the jobs you are targeting, and let CareerOS map your
            readiness in one workspace.
          </p>
          <Link className="btn-primary mt-8 min-w-[10rem]" href="/sign-up">
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}
