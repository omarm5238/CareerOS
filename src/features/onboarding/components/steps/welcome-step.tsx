type WelcomeStepProps = {
  onContinue: () => void;
};

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="section-eyebrow">Step 1 of 4</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Welcome to CareerOS
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          CareerOS will build your initial career profile from your resume so your
          workspace can start with structure and clear next steps.
        </p>
      </header>

      <button
        className="btn-primary w-full"
        onClick={onContinue}
        type="button"
      >
        Continue
      </button>
    </section>
  );
}
