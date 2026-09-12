import type { ApplicationProvider } from "@/generated/prisma/client";

export type ProviderValidationStatus =
  | "UNVALIDATED"
  | "LIVE_INSPECTED"
  | "LIVE_FORM_VALIDATED"
  | "SUBMIT_CONTROL_VALIDATED"
  | "SUBMISSION_VERIFIED"
  | "PARTIAL"
  | "DRIFTED"
  | "DISABLED";

export type ProviderValidationGrade = "PASS" | "PARTIAL" | "FAIL";

export type ProviderValidationResult = {
  provider: ApplicationProvider;
  detection: ProviderValidationGrade;
  formInspection: ProviderValidationGrade;
  navigation: ProviderValidationGrade;
  submitControl: ProviderValidationGrade;
  verification: ProviderValidationGrade;
  confirmedSubmitEnabled: boolean;
  limitations: string[];
};

export type ProviderCapabilityDefinition = {
  provider: ApplicationProvider;
  adapterVersion: string;
  liveInspectionValidated: boolean;
  liveFormValidated: boolean;
  submitControlValidated: boolean;
  verificationValidated: boolean;
  confirmedBrowserSubmitEligible: boolean;
  validationStatus: ProviderValidationStatus;
  knownLimitations: string[];
  validation: ProviderValidationResult;
};

const PUBLIC_ONLY = "Public live inspection only. No sandbox/test tenant submit.";
const NO_LIVE_VERIFY = "Live verification is not proven. Fixture success markers are not live proof.";

function disabledValidation(provider: ApplicationProvider, extra: string[]): ProviderValidationResult {
  return {
    provider,
    detection: "PASS",
    formInspection: "PARTIAL",
    navigation: "PARTIAL",
    submitControl: "PARTIAL",
    verification: "PARTIAL",
    confirmedSubmitEnabled: false,
    limitations: extra,
  };
}

const REGISTRY: Record<Exclude<ApplicationProvider, "GENERIC" | "UNKNOWN">, ProviderCapabilityDefinition> = {
  GREENHOUSE: {
    provider: "GREENHOUSE",
    adapterVersion: "greenhouse-v2",
    liveInspectionValidated: true,
    liveFormValidated: true,
    submitControlValidated: false,
    verificationValidated: false,
    confirmedBrowserSubmitEligible: false,
    validationStatus: "LIVE_FORM_VALIDATED",
    knownLimitations: [
      PUBLIC_ONLY,
      NO_LIVE_VERIFY,
      "Live job-boards.greenhouse.io pages often include reCAPTCHA before submit.",
    ],
    validation: disabledValidation("GREENHOUSE", [PUBLIC_ONLY, NO_LIVE_VERIFY, "reCAPTCHA on live forms"]),
  },
  LEVER: {
    provider: "LEVER",
    adapterVersion: "lever-v2",
    liveInspectionValidated: true,
    liveFormValidated: true,
    submitControlValidated: false,
    verificationValidated: false,
    confirmedBrowserSubmitEligible: false,
    validationStatus: "LIVE_FORM_VALIDATED",
    knownLimitations: [PUBLIC_ONLY, NO_LIVE_VERIFY, "Application form is on /apply. Live pages may include CAPTCHA."],
    validation: disabledValidation("LEVER", [PUBLIC_ONLY, NO_LIVE_VERIFY]),
  },
  ASHBY: {
    provider: "ASHBY",
    adapterVersion: "ashby-v2",
    liveInspectionValidated: true,
    liveFormValidated: false,
    submitControlValidated: false,
    verificationValidated: false,
    confirmedBrowserSubmitEligible: false,
    validationStatus: "PARTIAL",
    knownLimitations: [
      PUBLIC_ONLY,
      NO_LIVE_VERIFY,
      "Live job pages often require OPEN_APPLICATION before the form appears.",
    ],
    validation: {
      provider: "ASHBY",
      detection: "PASS",
      formInspection: "PARTIAL",
      navigation: "PARTIAL",
      submitControl: "FAIL",
      verification: "PARTIAL",
      confirmedSubmitEnabled: false,
      limitations: [PUBLIC_ONLY, "Form not always rendered on job page"],
    },
  },
  WORKABLE: {
    provider: "WORKABLE",
    adapterVersion: "workable-v2",
    liveInspectionValidated: true,
    liveFormValidated: true,
    submitControlValidated: false,
    verificationValidated: false,
    confirmedBrowserSubmitEligible: false,
    validationStatus: "LIVE_FORM_VALIDATED",
    knownLimitations: [PUBLIC_ONLY, NO_LIVE_VERIFY, "Avoid hashed CSS classes; use semantic form structure."],
    validation: disabledValidation("WORKABLE", [PUBLIC_ONLY, NO_LIVE_VERIFY]),
  },
  SMARTRECRUITERS: {
    provider: "SMARTRECRUITERS",
    adapterVersion: "smartrecruiters-v2",
    liveInspectionValidated: true,
    liveFormValidated: false,
    submitControlValidated: false,
    verificationValidated: false,
    confirmedBrowserSubmitEligible: false,
    validationStatus: "PARTIAL",
    knownLimitations: [
      PUBLIC_ONLY,
      NO_LIVE_VERIFY,
      "I'm interested is an OPEN_APPLICATION CTA, not final submit.",
    ],
    validation: {
      provider: "SMARTRECRUITERS",
      detection: "PASS",
      formInspection: "PARTIAL",
      navigation: "PARTIAL",
      submitControl: "FAIL",
      verification: "PARTIAL",
      confirmedSubmitEnabled: false,
      limitations: [PUBLIC_ONLY, "Public job page is a CTA, not the application form"],
    },
  },
};

const eligibilityOverride = new Map<ApplicationProvider, boolean>();

export function setProviderEligibilityOverrideForTests(provider: ApplicationProvider, eligible: boolean | null): void {
  if (eligible == null) eligibilityOverride.delete(provider);
  else eligibilityOverride.set(provider, eligible);
}

export function clearProviderEligibilityOverridesForTests(): void {
  eligibilityOverride.clear();
}

export function getProviderCapability(provider: ApplicationProvider): ProviderCapabilityDefinition {
  if (provider === "GENERIC" || provider === "UNKNOWN") {
    return {
      provider,
      adapterVersion: provider === "GENERIC" ? "generic-v1" : "unknown-v1",
      liveInspectionValidated: false,
      liveFormValidated: false,
      submitControlValidated: false,
      verificationValidated: false,
      confirmedBrowserSubmitEligible: false,
      validationStatus: "DISABLED",
      knownLimitations: ["Generic adapter never confirmed-submits."],
      validation: {
        provider,
        detection: "PARTIAL",
        formInspection: "PARTIAL",
        navigation: "PARTIAL",
        submitControl: "FAIL",
        verification: "PARTIAL",
        confirmedSubmitEnabled: false,
        limitations: ["Generic adapter never confirmed-submits."],
      },
    };
  }
  const base = REGISTRY[provider];
  const override = eligibilityOverride.get(provider);
  if (override == null) return base;
  return { ...base, confirmedBrowserSubmitEligible: override };
}

export function getDedicatedProviderCapabilities(): ProviderCapabilityDefinition[] {
  return Object.values(REGISTRY);
}
