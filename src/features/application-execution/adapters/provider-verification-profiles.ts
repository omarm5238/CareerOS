import type { ApplicationProvider } from "@/generated/prisma/client";

export type ProviderVerificationProfile = {
  provider: ApplicationProvider;
  successUrlPatterns: RegExp[];
  successSelectors: string[];
  failureSelectors: string[];
  duplicatePatterns: RegExp[];
  jobClosedPatterns: RegExp[];
  applicationIdExtractors: RegExp[];
};

export const PROVIDER_VERIFICATION_PROFILES: Record<Exclude<ApplicationProvider, "GENERIC" | "UNKNOWN">, ProviderVerificationProfile> = {
  GREENHOUSE: {
    provider: "GREENHOUSE",
    successUrlPatterns: [/greenhouse\.io\/.+\/confirmation/i, /job-boards\.greenhouse\.io\/.+\/confirmation/i],
    successSelectors: ["[data-provider-success='gh-application-success']", "[data-careeros-marker='gh-application-success']"],
    failureSelectors: ["[data-provider-error='gh-application-error']"],
    duplicatePatterns: [/already applied/i, /application already exists/i, /you('ve| have) already submitted/i],
    jobClosedPatterns: [/no longer accepting applications/i, /this job is closed/i, /job is no longer available/i],
    applicationIdExtractors: [/application id[:\s]+([a-z0-9-]+)/i],
  },
  LEVER: {
    provider: "LEVER",
    successUrlPatterns: [/jobs\.lever\.co\/.+\/thanks/i],
    successSelectors: ["[data-provider-success='lever-application-success']"],
    failureSelectors: ["[data-provider-error='lever-application-error']"],
    duplicatePatterns: [/already applied/i, /application already exists/i],
    jobClosedPatterns: [/no longer accepting applications/i, /this job is closed/i],
    applicationIdExtractors: [/application id[:\s]+([a-z0-9-]+)/i],
  },
  ASHBY: {
    provider: "ASHBY",
    successUrlPatterns: [/ashbyhq\.com\/.+\/submitted/i],
    successSelectors: ["[data-provider-success='ashby-application-success']"],
    failureSelectors: ["[data-provider-error='ashby-application-error']"],
    duplicatePatterns: [/already applied/i, /application already exists/i],
    jobClosedPatterns: [/no longer accepting applications/i, /this job is closed/i],
    applicationIdExtractors: [/application id[:\s]+([a-z0-9-]+)/i],
  },
  WORKABLE: {
    provider: "WORKABLE",
    successUrlPatterns: [/apply\.workable\.com\/.+\/submitted/i],
    successSelectors: ["[data-provider-success='workable-application-success']"],
    failureSelectors: ["[data-provider-error='workable-application-error']"],
    duplicatePatterns: [/already applied/i, /application already exists/i],
    jobClosedPatterns: [/no longer accepting applications/i, /this job is closed/i],
    applicationIdExtractors: [/application id[:\s]+([a-z0-9-]+)/i],
  },
  SMARTRECRUITERS: {
    provider: "SMARTRECRUITERS",
    successUrlPatterns: [/smartrecruiters\.com\/.+\/confirmation/i],
    successSelectors: ["[data-provider-success='sr-application-success']"],
    failureSelectors: ["[data-provider-error='sr-application-error']"],
    duplicatePatterns: [/already applied/i, /application already exists/i],
    jobClosedPatterns: [/no longer accepting applications/i, /this job is closed/i],
    applicationIdExtractors: [/application id[:\s]+([a-z0-9-]+)/i],
  },
};

export function verificationProfileFor(provider: ApplicationProvider): ProviderVerificationProfile | null {
  if (provider === "GENERIC" || provider === "UNKNOWN") return null;
  return PROVIDER_VERIFICATION_PROFILES[provider];
}

export function foreignSuccessMarkerPresent(provider: ApplicationProvider, blob: string): boolean {
  for (const [name, profile] of Object.entries(PROVIDER_VERIFICATION_PROFILES)) {
    if (name === provider) continue;
    if (profile.successSelectors.some((selector) => blob.includes(selector.replace(/[[\]'=]/g, "").slice(0, 18)))) {
      const marker = profile.successSelectors.join(" ").toLowerCase();
      if (blob.includes(name.toLowerCase()) && /success/.test(blob) && marker) return true;
    }
    const token = `${name.toLowerCase()}-application-success`;
    if (blob.includes(token)) return true;
  }
  return false;
}
