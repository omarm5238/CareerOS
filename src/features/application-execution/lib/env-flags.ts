import type { ApplicationProvider } from "@/generated/prisma/client";

export function envFlagEnabled(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isGlobalConfirmedSubmitEnabled(): boolean {
  return envFlagEnabled("CAREEROS_CONFIRMED_BROWSER_SUBMIT");
}

const PROVIDER_FLAGS: Record<Exclude<ApplicationProvider, "GENERIC" | "UNKNOWN">, string> = {
  GREENHOUSE: "CAREEROS_SUBMIT_GREENHOUSE",
  LEVER: "CAREEROS_SUBMIT_LEVER",
  ASHBY: "CAREEROS_SUBMIT_ASHBY",
  WORKABLE: "CAREEROS_SUBMIT_WORKABLE",
  SMARTRECRUITERS: "CAREEROS_SUBMIT_SMARTRECRUITERS",
};

export function isProviderSubmitSwitchEnabled(provider: ApplicationProvider): boolean {
  if (provider === "GENERIC" || provider === "UNKNOWN") return false;
  return envFlagEnabled(PROVIDER_FLAGS[provider]);
}
