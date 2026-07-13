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
      <div className="absolute inset-0 opacity-[0.32] sm:opacity-[0.42]">
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
        <section className="w-full max-w-[560px] rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_74%)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-8">
          <div className="mb-8 space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
              CareerOS Onboarding
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(245_245_245_/_10%)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] [transition:width_320ms_var(--ease-standard)]"
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
