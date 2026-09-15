export const LINKEDIN_ERROR_CODES = [
  "LINKEDIN_NOT_CONNECTED",
  "LINKEDIN_REAUTH_REQUIRED",
  "LINKEDIN_SCOPE_MISSING",
  "LINKEDIN_APP_APPROVAL_REQUIRED",
  "LINKEDIN_CAPABILITY_RESTRICTED",
  "LINKEDIN_ACCOUNT_MISMATCH",
  "LINKEDIN_PUBLISH_ALREADY_COMPLETED",
  "LINKEDIN_PUBLISH_IN_PROGRESS",
  "LINKEDIN_PUBLISH_PLAN_STALE",
  "LINKEDIN_PUBLISH_CONTENT_CHANGED",
  "LINKEDIN_PUBLISH_REJECTED",
  "LINKEDIN_PUBLISH_FAILED",
  "LINKEDIN_PUBLISH_UNCERTAIN",
  "LINKEDIN_MEDIA_UPLOAD_FAILED",
  "LINKEDIN_CONTENT_UNSUPPORTED",
  "LINKEDIN_ANALYTICS_NOT_GRANTED",
  "LINKEDIN_ANALYTICS_NOT_APPROVED",
  "LINKEDIN_ANALYTICS_SYNC_FAILED",
  "LINKEDIN_RATE_LIMITED",
  "LINKEDIN_API_UNAVAILABLE",
  "LINKEDIN_INVALID_RESPONSE",
  "LINKEDIN_OAUTH_STATE_INVALID",
  "LINKEDIN_OAUTH_EXPIRED",
  "LINKEDIN_CREDENTIALS_MISSING",
] as const;

export type LinkedinErrorCode = (typeof LINKEDIN_ERROR_CODES)[number];

export const LINKEDIN_ERROR_MESSAGES: Record<LinkedinErrorCode, string> = {
  LINKEDIN_NOT_CONNECTED: "Connect your LinkedIn account to use official publishing.",
  LINKEDIN_REAUTH_REQUIRED: "Your LinkedIn authorization is no longer valid. Reconnect to continue.",
  LINKEDIN_SCOPE_MISSING:
    "CareerOS does not currently have permission to perform this LinkedIn action. Reconnect and grant the required permission, or continue manually.",
  LINKEDIN_APP_APPROVAL_REQUIRED:
    "This feature requires additional LinkedIn API approval and is not enabled for this CareerOS app yet.",
  LINKEDIN_CAPABILITY_RESTRICTED:
    "LinkedIn does not currently provide this capability to CareerOS through the available API access.",
  LINKEDIN_ACCOUNT_MISMATCH:
    "That LinkedIn account does not match the connected account. Disconnect the existing LinkedIn account first, then connect the new account.",
  LINKEDIN_PUBLISH_ALREADY_COMPLETED: "This publishing plan is already published.",
  LINKEDIN_PUBLISH_IN_PROGRESS: "A LinkedIn publish attempt is already in progress for this plan.",
  LINKEDIN_PUBLISH_PLAN_STALE: "This publishing plan is no longer valid for official publishing.",
  LINKEDIN_PUBLISH_CONTENT_CHANGED: "The approved content changed before publish. CareerOS did not send a LinkedIn request.",
  LINKEDIN_PUBLISH_REJECTED: "LinkedIn rejected this post before it was created.",
  LINKEDIN_PUBLISH_FAILED: "Official LinkedIn publishing failed. The publishing plan was not marked published.",
  LINKEDIN_PUBLISH_UNCERTAIN:
    "LinkedIn may have received this post, but CareerOS could not verify the result. Do not retry yet to avoid creating a duplicate post.",
  LINKEDIN_MEDIA_UPLOAD_FAILED: "LinkedIn media upload is not available for this post.",
  LINKEDIN_CONTENT_UNSUPPORTED: "This post format is not supported for official LinkedIn publishing.",
  LINKEDIN_ANALYTICS_NOT_GRANTED: "Reconnect to grant the required analytics permission.",
  LINKEDIN_ANALYTICS_NOT_APPROVED:
    "Official LinkedIn analytics require additional API approval. Manual performance tracking remains available.",
  LINKEDIN_ANALYTICS_SYNC_FAILED: "Official LinkedIn analytics could not be synced. Existing manual snapshots were not changed.",
  LINKEDIN_RATE_LIMITED: "LinkedIn temporarily limited API requests. CareerOS did not automatically retry the post.",
  LINKEDIN_API_UNAVAILABLE: "LinkedIn is temporarily unavailable. Your CareerOS publishing plan remains unchanged.",
  LINKEDIN_INVALID_RESPONSE: "LinkedIn returned a response CareerOS could not verify.",
  LINKEDIN_OAUTH_STATE_INVALID: "This LinkedIn authorization request is invalid or was already used.",
  LINKEDIN_OAUTH_EXPIRED: "This LinkedIn authorization request expired. Start the connection again.",
  LINKEDIN_CREDENTIALS_MISSING: "Official LinkedIn connection is not configured for this CareerOS environment.",
};

const HTTP_STATUS: Record<LinkedinErrorCode, number> = {
  LINKEDIN_NOT_CONNECTED: 409,
  LINKEDIN_REAUTH_REQUIRED: 409,
  LINKEDIN_SCOPE_MISSING: 403,
  LINKEDIN_APP_APPROVAL_REQUIRED: 409,
  LINKEDIN_CAPABILITY_RESTRICTED: 409,
  LINKEDIN_ACCOUNT_MISMATCH: 409,
  LINKEDIN_PUBLISH_ALREADY_COMPLETED: 409,
  LINKEDIN_PUBLISH_IN_PROGRESS: 409,
  LINKEDIN_PUBLISH_PLAN_STALE: 409,
  LINKEDIN_PUBLISH_CONTENT_CHANGED: 409,
  LINKEDIN_PUBLISH_REJECTED: 400,
  LINKEDIN_PUBLISH_FAILED: 409,
  LINKEDIN_PUBLISH_UNCERTAIN: 409,
  LINKEDIN_MEDIA_UPLOAD_FAILED: 409,
  LINKEDIN_CONTENT_UNSUPPORTED: 400,
  LINKEDIN_ANALYTICS_NOT_GRANTED: 403,
  LINKEDIN_ANALYTICS_NOT_APPROVED: 409,
  LINKEDIN_ANALYTICS_SYNC_FAILED: 409,
  LINKEDIN_RATE_LIMITED: 429,
  LINKEDIN_API_UNAVAILABLE: 503,
  LINKEDIN_INVALID_RESPONSE: 502,
  LINKEDIN_OAUTH_STATE_INVALID: 400,
  LINKEDIN_OAUTH_EXPIRED: 400,
  LINKEDIN_CREDENTIALS_MISSING: 503,
};

export type LinkedinProviderClassification = {
  code: LinkedinErrorCode;
  attemptStatus: "FAILED" | "UNCERTAIN";
  retryAllowed: boolean;
  reauthRequired: boolean;
  capabilityRefreshRequired: boolean;
  uncertain: boolean;
  retryAfterSeconds: number | null;
};

export class LinkedinIntegrationError extends Error {
  readonly code: LinkedinErrorCode;
  readonly httpStatus: number;
  readonly retryAllowed: boolean;
  readonly reauthRequired: boolean;
  readonly capabilityRefreshRequired: boolean;
  readonly uncertain: boolean;

  constructor(
    code: LinkedinErrorCode,
    message?: string,
    flags: Partial<Pick<LinkedinIntegrationError, "retryAllowed" | "reauthRequired" | "capabilityRefreshRequired" | "uncertain">> = {},
  ) {
    super(message ?? LINKEDIN_ERROR_MESSAGES[code]);
    this.name = "LinkedinIntegrationError";
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.retryAllowed = flags.retryAllowed ?? false;
    this.reauthRequired = flags.reauthRequired ?? false;
    this.capabilityRefreshRequired = flags.capabilityRefreshRequired ?? false;
    this.uncertain = flags.uncertain ?? false;
  }
}

export function isLinkedinIntegrationError(error: unknown): error is LinkedinIntegrationError {
  return error instanceof LinkedinIntegrationError;
}

export function sanitizeProviderError(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? { message: clipProviderText(value) } : null;
  }
  const source = value as Record<string, unknown>;
  const forbidden = /accessToken|clientSecret|authorizationCode|refreshToken|code_verifier|pkce|encryption/i;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(source)) {
    if (forbidden.test(key)) continue;
    if (typeof raw === "string") out[key] = clipProviderText(raw);
    else if (typeof raw === "number" || typeof raw === "boolean") out[key] = raw;
    else if (Array.isArray(raw)) out[key] = raw.slice(0, 8).map((item) => (typeof item === "string" ? clipProviderText(item) : typeof item));
  }
  return out;
}

function clipProviderText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 280);
}
