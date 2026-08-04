import { onboardingProcessingStages } from "../../constants";
import type { ProcessingStageId } from "../../types";

type ProcessingStepProps = {
  stage: ProcessingStageId;
  progress: number;
};

export function ProcessingStep({ stage, progress }: ProcessingStepProps) {
  const currentStage =
    onboardingProcessingStages.find((item) => item.id === stage) ??
    onboardingProcessingStages[0];

  return (
    <section aria-live="polite" className="space-y-6">
      <header className="space-y-3">
        <p className="section-eyebrow">Step 3 of 4</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Building your profile
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          CareerOS is processing your resume and preparing your initial career
          profile.
        </p>
      </header>

      <div className="surface-card space-y-3 p-4">
        <div className="progress-track h-2 w-full">
          <div
            className="progress-fill [transition:width_400ms_var(--ease-standard)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-[var(--color-text-primary)]">{currentStage.label}</p>
      </div>
    </section>
  );
}
