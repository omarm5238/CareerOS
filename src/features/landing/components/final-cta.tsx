import Link from "next/link";

export function FinalCta() {
  return (
    <section className="px-6 py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-[rgb(99_102_241_/_18%)] bg-[linear-gradient(135deg,rgb(17_17_17_/_78%),rgb(10_10_10_/_52%))] px-6 py-12 text-center shadow-[var(--shadow-md)] sm:px-10 sm:py-14">
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
            Build your career operating system.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
            Start with your resume, add the jobs you are targeting, and let CareerOS map your
            readiness in one workspace.
          </p>
          <Link
            className="mt-8 inline-flex rounded-[var(--radius-lg)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-accent-glow)] [transition:var(--motion-fade)] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/sign-up"
          >
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}
