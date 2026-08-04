"use client";

import { useRouter } from "next/navigation";

import { CareerCore } from "@/components/core/CareerCore";

import { AnalysisResultStep } from "./steps/analysis-result-step";
import { ProcessingStep } from "./steps/processing-step";
import { ResumeUploadStep } from "./steps/resume-upload-step";
import { WelcomeStep } from "./steps/welcome-step";
import { useOnboardingFlow } from "../hooks/use-onboarding-flow";

const progressByStep = {
  welcome: 25,
  upload: 50,
  processing: 75,
  analysis: 100,
} as const;

export function OnboardingFlow() {
  const router = useRouter();
  const {
    step,
    isDragging,
    fileName,
    fileSize,
    error,
    progress,
    processingStage,
    analysisResult,
    onContinueFromWelcome,
    onFileSelected,
    onFileRemoved,
    onAnalyzeResume,
    onEnterWorkspace,
    onReplaceResume,
    onDragStateChange,
  } = useOnboardingFlow();

  const coreMode = step === "processing" ? "loading" : "workspace";

  return (
    <main className="relative flex min-h-screen overflow-x-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <div className="pointer-events-none absolute inset-0 app-atmosphere" />
      <div className="absolute inset-0 opacity-[0.28] sm:opacity-[0.34]">
        <CareerCore
          animated
          className="h-full w-full"
          density="medium"
          interactive
          mode={coreMode}
          pulse
        />
      </div>

      <div className="relative z-10 flex w-full items-center justify-center px-4 py-10 sm:px-8">
        <section className="surface-elevated w-full max-w-[560px] p-6 sm:p-8">
          <div className="mb-8 space-y-3">
            <p className="section-eyebrow">CareerOS Onboarding</p>
            <div className="progress-track h-1.5 w-full">
              <div
                className="progress-fill [transition:width_320ms_var(--ease-standard)]"
                style={{ width: `${progressByStep[step]}%` }}
              />
            </div>
          </div>

          {step === "welcome" ? (
            <WelcomeStep onContinue={onContinueFromWelcome} />
          ) : null}

          {step === "upload" ? (
            <ResumeUploadStep
              error={error}
              fileName={fileName}
              fileSize={fileSize}
              isDragging={isDragging}
              isSubmitting={false}
              onAnalyze={onAnalyzeResume}
              onDragStateChange={onDragStateChange}
              onDropFile={onFileSelected}
              onRemoveFile={onFileRemoved}
            />
          ) : null}

          {step === "processing" ? (
            <ProcessingStep progress={progress} stage={processingStage} />
          ) : null}

          {step === "analysis" && analysisResult ? (
            <AnalysisResultStep
              onEnterWorkspace={() => {
                onEnterWorkspace();
                router.push("/workspace");
                router.refresh();
              }}
              onReplaceResume={onReplaceResume}
              result={analysisResult}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
