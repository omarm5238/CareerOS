import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--color-border-subtle)] bg-[rgb(8_10_13_/_78%)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-4 lg:px-8">
        <Link
          className="font-display text-sm font-semibold tracking-[0.18em] text-[var(--color-text-primary)] [transition:var(--motion-fade)] hover:text-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          href="/"
        >
          CareerOS
        </Link>

        <nav
          aria-label="Landing navigation"
          className="hidden items-center justify-center gap-6 text-sm text-[var(--color-text-secondary)] md:flex"
        >
          <a
            className="[transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="#features"
          >
            Features
          </a>
          <a
            className="[transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="#how-it-works"
          >
            How it works
          </a>
        </nav>

        <div className="flex items-center justify-end gap-3">
          <Link
            className="text-sm text-[var(--color-text-secondary)] [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/sign-in"
          >
            Sign in
          </Link>
          <Link className="btn-primary px-4 py-2" href="/sign-up">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
