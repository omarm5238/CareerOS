type WelcomeStepProps = {
  onContinue: () => void;
};

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
          Step 1 of 4
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Welcome to CareerOS
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          CareerOS will build your initial career profile from your resume so your
          workspace can start with structure and clear next steps.
        </p>
      </header>

      <button
        className="w-full rounded-[var(--radius-lg)] bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-accent-glow)] [transition:var(--motion-fade)] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        onClick={onContinue}
        type="button"
      >
        Continue
      </button>
    </section>
  );
}
