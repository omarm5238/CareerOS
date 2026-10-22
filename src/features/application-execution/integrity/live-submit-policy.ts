export type LiveAllowlistEntry = {
  provider: string;
  host: string;
  jobId: string;
  destination: string;
};

export type DryRunCertificationInput = {
  employerMatches: boolean;
  jobMatches: boolean;
  providerMatches: boolean;
  destinationMatches: boolean;
  packageMatches: boolean;
  resumeRevisionMatches: boolean;
  answersPresent: boolean;
  submitControlLocated: boolean;
  confirmationStrategyPresent: boolean;
  stoppedBeforeFinalSubmit: boolean;
};

export type LiveSubmitGateInput = {
  provider: string;
  host: string;
  jobId: string;
  destination: string;
  applicationId: string;
  expectedApplicationId: string;
  packageId: string;
  expectedPackageId: string;
  authorizationState: "ISSUED" | "CONSUMED" | "CANCELLED" | "EXPIRED" | null;
  authorizationExpired: boolean;
  dryRunStatus: string | null;
};

let liveProviderInvocations = 0;

export function liveProviderInvocationCount(): number {
  return liveProviderInvocations;
}

export function resetLiveProviderInvocations(): void {
  liveProviderInvocations = 0;
}

export function liveSubmitEnabled(): boolean {
  return process.env.LIVE_PROVIDER_SUBMIT_ENABLED === "true";
}

export function readLiveAllowlist(): LiveAllowlistEntry[] {
  const raw = process.env.CAREEROS_LIVE_SUBMIT_ALLOWLIST?.trim();
  if (!raw) return [];
  return raw.split(",").flatMap((entry) => {
    const [provider, host, jobId, destination] = entry.split("|").map((part) => part.trim());
    if (!provider || !host || !jobId || !destination) return [];
    return [{ provider, host, jobId, destination }];
  });
}

export function certifyDryRun(input: DryRunCertificationInput): "DRY_RUN_CERTIFIED" | "DRY_RUN_FAILED" {
  const checks = [
    input.employerMatches,
    input.jobMatches,
    input.providerMatches,
    input.destinationMatches,
    input.packageMatches,
    input.resumeRevisionMatches,
    input.answersPresent,
    input.submitControlLocated,
    input.confirmationStrategyPresent,
    input.stoppedBeforeFinalSubmit,
  ];
  return checks.every(Boolean) ? "DRY_RUN_CERTIFIED" : "DRY_RUN_FAILED";
}

export function evaluateLiveSubmitGate(input: LiveSubmitGateInput): { allowed: false; reason: string } | { allowed: true } {
  if (!liveSubmitEnabled()) return { allowed: false, reason: "LIVE_SUBMIT_DISABLED" };
  if (input.applicationId !== input.expectedApplicationId) return { allowed: false, reason: "WRONG_APPLICATION" };
  if (input.packageId !== input.expectedPackageId) return { allowed: false, reason: "WRONG_PACKAGE" };
  const match = readLiveAllowlist().find(
    (entry) =>
      entry.provider === input.provider &&
      entry.host === input.host &&
      entry.jobId === input.jobId &&
      entry.destination === input.destination,
  );
  if (!match) return { allowed: false, reason: "TARGET_NOT_ALLOWLISTED" };
  if (input.dryRunStatus !== "DRY_RUN_CERTIFIED") return { allowed: false, reason: "DRY_RUN_REQUIRED" };
  if (input.authorizationState !== "ISSUED" || input.authorizationExpired) {
    return { allowed: false, reason: "AUTHORIZATION_NOT_USABLE" };
  }
  return { allowed: true };
}

export async function attemptLiveProviderSubmit(
  input: LiveSubmitGateInput,
  send: () => Promise<void>,
): Promise<{ allowed: false; reason: string } | { allowed: true }> {
  const gate = evaluateLiveSubmitGate(input);
  if (!gate.allowed) return gate;
  liveProviderInvocations += 1;
  await send();
  return { allowed: true };
}
