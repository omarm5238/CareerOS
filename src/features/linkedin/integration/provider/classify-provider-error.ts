import { LinkedinIntegrationError, type LinkedinErrorCode, type LinkedinProviderClassification } from "../errors";
import type { LinkedinNetworkPhase, LinkedinProviderError } from "./types";

export function classifyLinkedinProviderError(input: {
  httpStatus: number | null;
  networkPhase: LinkedinNetworkPhase;
  body?: unknown;
  message?: string;
}): LinkedinProviderClassification {
  const { httpStatus, networkPhase } = input;
  const afterSend = networkPhase === "AFTER_POSSIBLE_SEND";

  if (httpStatus === 401) {
    return classify("LINKEDIN_REAUTH_REQUIRED", "FAILED", {
      reauthRequired: true,
      capabilityRefreshRequired: true,
    });
  }
  if (httpStatus === 403) {
    return classify("LINKEDIN_SCOPE_MISSING", "FAILED", { capabilityRefreshRequired: true });
  }
  if (httpStatus === 400) {
    return classify("LINKEDIN_PUBLISH_REJECTED", "FAILED");
  }
  if (httpStatus === 429) {
    if (afterSend) return classify("LINKEDIN_RATE_LIMITED", "UNCERTAIN", { uncertain: true });
    return classify("LINKEDIN_RATE_LIMITED", "FAILED");
  }
  if (httpStatus === 408 || input.message?.includes("TIMEOUT")) {
    if (afterSend) return classify("LINKEDIN_API_UNAVAILABLE", "UNCERTAIN", { uncertain: true });
    return classify("LINKEDIN_API_UNAVAILABLE", "FAILED");
  }
  if (!httpStatus || httpStatus >= 500) {
    if (afterSend) return classify("LINKEDIN_API_UNAVAILABLE", "UNCERTAIN", { uncertain: true });
    return classify("LINKEDIN_API_UNAVAILABLE", "FAILED");
  }
  if (afterSend) {
    return classify("LINKEDIN_INVALID_RESPONSE", "UNCERTAIN", { uncertain: true });
  }
  return classify("LINKEDIN_PUBLISH_FAILED", "FAILED");
}

export function toIntegrationErrorFromProvider(error: LinkedinProviderError): LinkedinIntegrationError {
  const classified = classifyLinkedinProviderError(error);
  return new LinkedinIntegrationError(classified.code, undefined, classified);
}

function classify(
  code: LinkedinErrorCode,
  attemptStatus: "FAILED" | "UNCERTAIN",
  flags: Partial<LinkedinProviderClassification> = {},
): LinkedinProviderClassification {
  return {
    code,
    attemptStatus,
    retryAllowed: attemptStatus === "FAILED",
    reauthRequired: flags.reauthRequired ?? false,
    capabilityRefreshRequired: flags.capabilityRefreshRequired ?? false,
    uncertain: attemptStatus === "UNCERTAIN",
    retryAfterSeconds: flags.retryAfterSeconds ?? null,
  };
}
