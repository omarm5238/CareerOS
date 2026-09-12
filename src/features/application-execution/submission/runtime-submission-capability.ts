import type { ApplicationProvider } from "@/generated/prisma/client";

import { isConfirmedSubmitEnabledForProvider } from "../adapters/confirmed-submit-policy";
import { getProviderCapability } from "../adapters/provider-submission-capabilities";
import { verificationProfileFor } from "../adapters/provider-verification-profiles";
import type { ApplicationActionAssessment } from "../classification/classify-application-action";
import type { ApplicationFormSnapshot, DetectionResult, InterruptionKind, RuntimeSubmissionCapability } from "../types";

export type { RuntimeSubmissionCapability };

export function computeRuntimeSubmissionCapability(input: {
  provider: ApplicationProvider;
  detection: Pick<DetectionResult, "confidence" | "drifted" | "cautious">;
  snapshot: ApplicationFormSnapshot | null;
  actions: ApplicationActionAssessment[];
  interruption: InterruptionKind;
  drifted: boolean;
  unsupportedWidget: boolean;
  formFingerprintStable: boolean;
  reviewComplete: boolean;
}): RuntimeSubmissionCapability {
  const capability = getProviderCapability(input.provider);
  const reasons: string[] = [];
  const dedicated = input.provider !== "GENERIC" && input.provider !== "UNKNOWN";
  const providerDetected = dedicated && input.detection.confidence >= 0.95 && !input.detection.drifted;
  if (!dedicated) reasons.push("not-dedicated-provider");
  if (input.detection.confidence < 0.95) reasons.push("provider-confidence-below-0.95");
  if (input.detection.drifted || input.drifted) reasons.push("adapter-drift");
  if (input.interruption) reasons.push(`unresolved-${input.interruption.toLowerCase()}`);
  if (input.unsupportedWidget) reasons.push("unsupported-final-widget");
  if (!input.formFingerprintStable) reasons.push("form-fingerprint-unstable");
  if (!input.reviewComplete) reasons.push("final-review-incomplete");

  const formRecognized = Boolean(input.snapshot && input.snapshot.fields.length >= 3);
  if (!formRecognized) reasons.push("form-not-recognized");

  const finalSubmit = input.actions.find((item) => item.action === "FINAL_SUBMIT" && item.trusted);
  const ambiguousSubmit = input.actions.filter((item) => item.action === "FINAL_SUBMIT").length > 1 && !finalSubmit;
  const submitControlTrusted = Boolean(finalSubmit) && !ambiguousSubmit;
  if (!submitControlTrusted) reasons.push(ambiguousSubmit ? "submit-control-ambiguous" : "submit-control-not-trusted");

  const finalStepRecognized = Boolean(
    input.snapshot && (input.snapshot.submitControl?.isFinal || finalSubmit) && !input.snapshot.nextControl,
  );
  if (!finalStepRecognized) reasons.push("final-step-not-recognized");

  const verificationStrategyTrusted = dedicated && Boolean(verificationProfileFor(input.provider)) && !input.drifted;
  if (!verificationStrategyTrusted) reasons.push("verification-strategy-not-trusted");

  const providerEligible = isConfirmedSubmitEnabledForProvider(input.provider);
  if (!providerEligible) reasons.push("provider-or-global-switch-disabled");

  const confirmedBrowserSubmit =
    providerEligible &&
    dedicated &&
    providerDetected &&
    formRecognized &&
    finalStepRecognized &&
    submitControlTrusted &&
    verificationStrategyTrusted &&
    !input.drifted &&
    !input.detection.drifted &&
    !input.interruption &&
    !input.unsupportedWidget &&
    input.formFingerprintStable &&
    input.reviewComplete;

  if (confirmedBrowserSubmit) reasons.unshift("runtime-trusted");
  else reasons.unshift("runtime-untrusted");

  return {
    provider: input.provider,
    adapterVersion: capability.adapterVersion,
    providerDetected,
    formRecognized,
    finalStepRecognized,
    submitControlTrusted,
    verificationStrategyTrusted,
    confirmedBrowserSubmit,
    confidence: input.detection.confidence,
    reasons,
  };
}
