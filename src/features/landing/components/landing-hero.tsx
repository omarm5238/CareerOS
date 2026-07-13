import Link from "next/link";

import { LandingCoreVisual } from "./landing-core-visual";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-6 py-16 lg:px-8 lg:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgb(99_102_241_/_10%),transparent_34%),radial-gradient(circle_at_82%_72%,rgb(245_245_245_/_3%),transparent_28%)]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-accent)]">CareerOS</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--color-text-primary)] sm:text-5xl lg:text-[3.25rem]">
            Your career, mapped into an intelligent operating system.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
            CareerOS analyzes your resume, compares it with saved jobs, identifies skill gaps,
            and tracks your application progress in one focused workspace.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex rounded-[var(--radius-lg)] bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-accent-glow)] [transition:var(--motion-fade)] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/sign-up"
            >
              Start building profile
            </Link>
            <Link
              className="inline-flex rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_58%)] px-5 py-3 text-sm font-medium text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/sign-in"
            >
              Sign in
            </Link>
          </div>

          <a
            className="mt-4 inline-flex text-sm text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
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
