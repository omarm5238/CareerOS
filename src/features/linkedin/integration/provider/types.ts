export const LINKEDIN_FIXTURE_SCENARIOS = [
  "SUCCESS",
  "MISSING_SCOPE",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "TIMEOUT_BEFORE_SEND",
  "TIMEOUT_AFTER_SEND",
  "MALFORMED_RESPONSE",
  "DEFINITE_REJECTION",
  "AMBIGUOUS_RESPONSE",
  "TOKEN_EXPIRED",
  "ACCOUNT_MISMATCH",
  "API_UNAVAILABLE_BEFORE_SEND",
  "API_UNAVAILABLE_AFTER_SEND",
] as const;

export type LinkedinFixtureScenario = (typeof LINKEDIN_FIXTURE_SCENARIOS)[number];

export type LinkedinNetworkPhase = "BEFORE_SEND" | "AFTER_POSSIBLE_SEND";

export type LinkedinAuthorizationRequest = {
  state: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
};

export type LinkedinTokenExchangeResult = {
  accessToken: string;
  expiresAt: Date | null;
  grantedScopes: string[];
  refreshToken: string | null;
};

export type LinkedinIdentity = {
  providerSubject: string;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
};

export type LinkedinPublishPostInput = {
  authorUrn: string;
  text: string;
  format: string;
  contentFingerprint: string;
  providerRequestId: string;
};

export type LinkedinPublishPostResult = {
  externalPostId: string;
  externalUrl: string | null;
  rawStatus: number;
};

export type LinkedinPostAnalytics = {
  impressions: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  reposts: number | null;
  saves: number | null;
};

export type LinkedinProfileAnalytics = {
  profileViews: number | null;
  newFollowers: number | null;
};

export type LinkedinProviderError = {
  code: string;
  httpStatus: number | null;
  networkPhase: LinkedinNetworkPhase;
  message: string;
  retryAfterSeconds: number | null;
  details: Record<string, unknown> | null;
};

export class LinkedinProviderRequestError extends Error {
  readonly provider: LinkedinProviderError;

  constructor(provider: LinkedinProviderError) {
    super(provider.message);
    this.name = "LinkedinProviderRequestError";
    this.provider = provider;
  }
}

export interface LinkedinApiClient {
  mode: "official" | "fixture";
  getAuthorizationUrl(input: LinkedinAuthorizationRequest): string;
  exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<LinkedinTokenExchangeResult>;
  getIdentity(accessToken: string): Promise<LinkedinIdentity>;
  publishPost(accessToken: string, input: LinkedinPublishPostInput): Promise<LinkedinPublishPostResult>;
  revokeConnection?(accessToken: string): Promise<void>;
  getPostAnalytics?(accessToken: string, externalPostId: string): Promise<LinkedinPostAnalytics>;
  getProfileAnalytics?(accessToken: string): Promise<LinkedinProfileAnalytics>;
}
