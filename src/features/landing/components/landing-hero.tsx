import Link from "next/link";

import { LandingCoreVisual } from "./landing-core-visual";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-6 py-20 lg:px-8 lg:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgb(199_203_209_/_6%),transparent_38%),radial-gradient(circle_at_82%_68%,rgb(207_193_154_/_5%),transparent_32%),radial-gradient(circle_at_54%_46%,rgb(91_86_152_/_2.5%),transparent_30%)]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
        <div className="max-w-xl">
          <p className="section-eyebrow text-[var(--color-champagne)]">CareerOS</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.06] tracking-tight text-[var(--color-text-primary)] sm:text-5xl lg:text-[3.4rem]">
            Your career, mapped into an intelligent operating system.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
            CareerOS analyzes your resume, compares it with saved jobs, identifies skill gaps,
            and tracks your application progress in one focused workspace.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link className="btn-primary min-w-[11.5rem]" href="/sign-up">
              Start building profile
            </Link>
            <Link className="btn-secondary" href="/sign-in">
              Sign in
            </Link>
          </div>

          <a
            className="mt-5 inline-flex text-sm text-[var(--color-silver-muted)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-champagne)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="#how-it-works"
          >
            See how it works
          </a>
        </div>

        <LandingCoreVisual />
      </div>
    </section>
  );
}
