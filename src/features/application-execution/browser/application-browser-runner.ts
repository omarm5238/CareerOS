import type { DetectionResult, InterruptionDetection, StepValidationResult, SubmissionVerificationResult } from "../types";
import type { ApplicationFormSnapshot, SubmitControlDescriptor } from "../types";

export type UploadedFileSpec = {
  filePath: string;
  fileName: string;
  mimeType: string;
};

export interface ApplicationBrowserPage {
  url(): string;
  title(): Promise<string>;
  evaluate<T>(fn: (arg: unknown) => T | Promise<T>, arg?: unknown): Promise<T>;
  evaluateExpression<T>(expression: string): Promise<T>;
  fill(selector: string, value: string): Promise<void>;
  check(selector: string, checked: boolean): Promise<void>;
  selectOption(selector: string, value: string): Promise<void>;
  setInputFiles(selector: string, file: UploadedFileSpec): Promise<void>;
  click(selector: string): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  contentSignals(): Promise<{
    title: string;
    url: string;
    markers: string[];
    hasPasswordField: boolean;
    hasOtpField: boolean;
    hasCaptcha: boolean;
    hasAssessment: boolean;
    hasChallengeFrame: boolean;
    bodyTextSample: string;
  }>;
}

export interface ApplicationBrowserRunner {
  launch(sessionId: string): Promise<void>;
  isAlive(sessionId: string): boolean;
  getPage(sessionId: string): ApplicationBrowserPage | null;
  navigate(sessionId: string, url: string): Promise<{ url: string; title: string }>;
  close(sessionId: string): Promise<void>;
  closeAll(): Promise<void>;
}

export type ApplicationExecutionAdapter = {
  provider: DetectionResult["provider"] | "GENERIC" | "UNKNOWN";
  version: string;
  capabilities(): import("../types").AdapterCapabilities;
  detect(page: ApplicationBrowserPage): Promise<DetectionResult>;
  inspect(page: ApplicationBrowserPage): Promise<ApplicationFormSnapshot>;
  detectInterruptions(page: ApplicationBrowserPage): Promise<InterruptionDetection>;
  fillField(page: ApplicationBrowserPage, selector: string, type: string, value: string | boolean): Promise<void>;
  uploadAsset(page: ApplicationBrowserPage, selector: string, file: UploadedFileSpec): Promise<void>;
  validateCurrentStep(page: ApplicationBrowserPage): Promise<StepValidationResult>;
  locateNextControl(page: ApplicationBrowserPage): Promise<SubmitControlDescriptor | null>;
  locateFinalSubmit(page: ApplicationBrowserPage): Promise<SubmitControlDescriptor | null>;
  advanceStep(page: ApplicationBrowserPage, selector: string): Promise<void>;
  executeConfirmedSubmit(page: ApplicationBrowserPage, selector: string): Promise<void>;
  verifySubmission(page: ApplicationBrowserPage): Promise<SubmissionVerificationResult>;
};
