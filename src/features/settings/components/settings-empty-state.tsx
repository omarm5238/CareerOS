import Link from "next/link";

export function SettingsEmptyState() {
  return (
    <div className="relative mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
          Settings
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Profile unavailable
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
          Your account profile could not be loaded. Try signing in again.
        </p>
      </div>

      <Link
        className="mt-8 text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        href="/workspace"
      >
        Back to Workspace
      </Link>
    </div>
  );
}
