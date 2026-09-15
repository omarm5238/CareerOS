export const LINKEDIN_OAUTH_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_OAUTH_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_OAUTH_REVOKE_URL = "https://www.linkedin.com/oauth/v2/revoke";
export const LINKEDIN_DEFAULT_API_BASE_URL = "https://api.linkedin.com";
export const LINKEDIN_DEFAULT_REST_VERSION = "202411";

export const LINKEDIN_BASELINE_SCOPES = ["openid", "profile", "email", "w_member_social"] as const;
export const LINKEDIN_PUBLISH_SCOPES = ["w_member_social"] as const;
export const LINKEDIN_ANALYTICS_SCOPES = ["r_member_postAnalytics", "r_member_profileAnalytics"] as const;

export const LINKEDIN_OAUTH_TTL_MS = 10 * 60 * 1000;
export const LINKEDIN_TOKEN_EXPIRING_SOON_MS = 5 * 60 * 1000;

export type LinkedinProviderMode = "official" | "fixture";

export function getLinkedinProviderMode(): LinkedinProviderMode {
  const explicit = process.env.CAREEROS_LINKEDIN_PROVIDER?.trim().toLowerCase();
  if (explicit === "fixture") return "fixture";
  return "official";
}

export function getLinkedinClientId(): string | null {
  return process.env.LINKEDIN_CLIENT_ID?.trim() || null;
}

export function getLinkedinClientSecret(): string | null {
  return process.env.LINKEDIN_CLIENT_SECRET?.trim() || null;
}

export function getLinkedinRedirectUri(): string {
  return (
    process.env.LINKEDIN_REDIRECT_URI?.trim() ||
    "http://localhost:3000/api/linkedin/connection/callback"
  );
}

export function getLinkedinApiBaseUrl(): string {
  return process.env.LINKEDIN_API_BASE_URL?.trim() || LINKEDIN_DEFAULT_API_BASE_URL;
}

export function getLinkedinRestVersion(): string {
  return process.env.LINKEDIN_REST_VERSION?.trim() || LINKEDIN_DEFAULT_REST_VERSION;
}

export function areOfficialLinkedinCredentialsConfigured(): boolean {
  return Boolean(getLinkedinClientId() && getLinkedinClientSecret());
}

export function isLinkedinAnalyticsAppApproved(): boolean {
  return process.env.CAREEROS_LINKEDIN_ANALYTICS_APPROVED === "1";
}

export function getRequestedLinkedinScopes(): string[] {
  return [...LINKEDIN_BASELINE_SCOPES];
}

export function isLiveTestPublishAllowed(): boolean {
  return process.env.CAREEROS_LINKEDIN_ALLOW_LIVE_TEST_PUBLISH === "1";
}
