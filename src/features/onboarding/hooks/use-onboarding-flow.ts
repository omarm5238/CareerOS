"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";

import type { ResumeAnalysisResult } from "@/features/resume";
import { validateResumeFile } from "@/features/resume";

import { onboardingProcessingStages } from "../constants";
import { writeOnboardingCompletedState } from "../lib/storage";
import type {
  OnboardingFlowState,
  OnboardingStep,
  ProcessingStageId,
} from "../types";

const TOTAL_PROCESSING_MS = 5000;
const TICK_MS = 125;

const initialFlowState: OnboardingFlowState = {
  step: "welcome",
  selectedFile: null,
  analysisResult: null,
  error: null,
  isDragging: false,
  progress: 0,
  processingStage: "reading",
  isProcessingLocked: false,
};

type OnboardingAction =
  | { type: "continue_to_upload" }
  | { type: "set_dragging"; value: boolean }
  | { type: "set_file"; value: File }
  | { type: "set_error"; value: string | null }
  | { type: "clear_file" }
  | { type: "start_processing" }
  | { type: "processing_tick"; progress: number; stage: ProcessingStageId }
  | {
      type: "finish_processing";
      result: ResumeAnalysisResult;
    }
  | { type: "processing_failed"; error: string }
  | { type: "replace_resume" };

function onboardingReducer(
  state: OnboardingFlowState,
  action: OnboardingAction,
): OnboardingFlowState {
  switch (action.type) {
    case "continue_to_upload":
      return { ...state, step: "upload", error: null };
    case "set_dragging":
      return { ...state, isDragging: action.value };
    case "set_file":
      return {
        ...state,
        selectedFile: action.value,
        analysisResult: null,
        error: null,
      };
    case "set_error":
      return { ...state, error: action.value };
    case "clear_file":
      return {
        ...state,
        selectedFile: null,
        analysisResult: null,
        error: null,
      };
    case "start_processing":
      return {
        ...state,
        step: "processing",
        progress: 0,
        processingStage: onboardingProcessingStages[0].id,
        isProcessingLocked: true,
        error: null,
      };
    case "processing_tick":
      return {
        ...state,
        progress: action.progress,
        processingStage: action.stage,
      };
    case "finish_processing":
      return {
        ...state,
        step: "analysis",
        progress: 100,
        processingStage: onboardingProcessingStages[onboardingProcessingStages.length - 1].id,
        isProcessingLocked: false,
        analysisResult: action.result,
      };
    case "processing_failed":
      return {
        ...state,
        step: "upload",
        progress: 0,
        processingStage: onboardingProcessingStages[0].id,
        isProcessingLocked: false,
        error: action.error,
      };
    case "replace_resume":
      return {
        ...state,
        step: "upload",
        selectedFile: null,
        analysisResult: null,
        error: null,
        progress: 0,
        processingStage: onboardingProcessingStages[0].id,
        isProcessingLocked: false,
      };
    default:
      return state;
  }
}

function validateResumeFileClient(file: File): string | null {
  const result = validateResumeFile({
    filename: file.name,
    mimeType: file.type,
    fileSize: file.size,
  });

  return result.valid ? null : result.message;
}

export function useOnboardingFlow() {
  const [state, dispatch] = useReducer(onboardingReducer, initialFlowState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestStartedRef = useRef(false);

  const step: OnboardingStep = state.step;
  const fileName = state.selectedFile?.name ?? null;
  const fileSize = state.selectedFile?.size ?? null;
  const isProcessing = step === "processing";

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (step !== "processing" || !state.selectedFile) {
      requestStartedRef.current = false;
      return;
    }

    if (requestStartedRef.current) return;
    requestStartedRef.current = true;

    const file = state.selectedFile;
    const stageDuration = TOTAL_PROCESSING_MS / onboardingProcessingStages.length;
    const startTime = Date.now();
    let cancelled = false;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / TOTAL_PROCESSING_MS, 1);
      const progress = Math.round(ratio * 100);
      const stageIndex = Math.min(
        onboardingProcessingStages.length - 1,
        Math.floor(elapsed / stageDuration),
      );

      dispatch({
        type: "processing_tick",
        progress,
        stage: onboardingProcessingStages[stageIndex].id,
      });
    }, TICK_MS);

    async function analyzeResume() {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/resume/analyze", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const body = (await response.json().catch(() => null)) as
          | ResumeAnalysisResult
          | { message?: string }
          | null;

        if (!response.ok) {
          const message =
            body && "message" in body && body.message
              ? body.message
              : "Resume analysis failed. Please try again.";
          throw new Error(message);
        }

        if (!body || !("role" in body)) {
          throw new Error("Resume analysis returned an invalid response.");
        }

        if (!cancelled) {
          dispatch({ type: "finish_processing", result: body });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({
            type: "processing_failed",
            error:
              error instanceof Error
                ? error.message
                : "Resume analysis failed. Please try again.",
          });
        }
      } finally {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }

    void analyzeResume();

    return () => {
      cancelled = true;
      requestStartedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [step, state.selectedFile]);

  const canAnalyze = useMemo(
    () =>
      !!state.selectedFile &&
      !state.error &&
      !isProcessing &&
      !state.isProcessingLocked,
    [state.selectedFile, state.error, state.isProcessingLocked, isProcessing],
  );

  function handleFile(file: File) {
    const validationError = validateResumeFileClient(file);
    if (validationError) {
      dispatch({ type: "clear_file" });
      dispatch({ type: "set_error", value: validationError });
      return;
    }

    dispatch({ type: "set_file", value: file });
  }

  function startProcessing() {
    if (!canAnalyze || !state.selectedFile) return;
    dispatch({ type: "start_processing" });
  }

  function completeOnboarding() {
    if (!state.analysisResult) return;

    writeOnboardingCompletedState({
      resumeFileName: state.analysisResult.resume.filename,
      resumeFileSize: state.analysisResult.resume.fileSize,
      profile: {
        role: state.analysisResult.role,
        experienceLevel: state.analysisResult.experienceLevel,
        completenessScore: state.analysisResult.completenessScore,
        detectedSkills: state.analysisResult.detectedSkills,
        suggestedFocus: state.analysisResult.suggestedFocus,
        profileSummary: state.analysisResult.profileSummary,
        analysisSource: state.analysisResult.analysisSource,
      },
    });
  }

  return {
    step,
    isDragging: state.isDragging,
    fileName,
    fileSize,
    error: state.error,
    canAnalyze,
    progress: state.progress,
    processingStage: state.processingStage,
    analysisResult: state.analysisResult,
    onContinueFromWelcome: () => dispatch({ type: "continue_to_upload" }),
    onFileSelected: handleFile,
    onFileRemoved: () => dispatch({ type: "clear_file" }),
    onAnalyzeResume: startProcessing,
    onEnterWorkspace: completeOnboarding,
    onReplaceResume: () => dispatch({ type: "replace_resume" }),
    onDragStateChange: (dragging: boolean) =>
      dispatch({ type: "set_dragging", value: dragging }),
  };
}
