import {
  getLinkedinApiBaseUrl,
  getLinkedinClientId,
  getLinkedinClientSecret,
  getLinkedinRestVersion,
  LINKEDIN_OAUTH_AUTHORIZE_URL,
  LINKEDIN_OAUTH_REVOKE_URL,
  LINKEDIN_OAUTH_TOKEN_URL,
} from "../config";
import { LinkedinIntegrationError } from "../errors";
import {
  LinkedinProviderRequestError,
  type LinkedinApiClient,
  type LinkedinAuthorizationRequest,
  type LinkedinIdentity,
  type LinkedinPostAnalytics,
  type LinkedinProfileAnalytics,
  type LinkedinPublishPostInput,
  type LinkedinPublishPostResult,
  type LinkedinTokenExchangeResult,
} from "./types";

export class OfficialLinkedinApiClient implements LinkedinApiClient {
  readonly mode = "official" as const;

  getAuthorizationUrl(input: LinkedinAuthorizationRequest): string {
    const clientId = getLinkedinClientId();
    if (!clientId) throw new LinkedinIntegrationError("LINKEDIN_CREDENTIALS_MISSING");
    const url = new URL(LINKEDIN_OAUTH_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    url.searchParams.set("scope", input.scopes.join(" "));
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<LinkedinTokenExchangeResult> {
    const clientId = getLinkedinClientId();
    const clientSecret = getLinkedinClientSecret();
    if (!clientId || !clientSecret) throw new LinkedinIntegrationError("LINKEDIN_CREDENTIALS_MISSING");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: input.codeVerifier,
    });

    const response = await fetch(LINKEDIN_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await safeJson(response)) as Record<string, unknown> | null;
    if (!response.ok || !json || typeof json.access_token !== "string") {
      throw new LinkedinProviderRequestError({
        code: "TOKEN_EXCHANGE_FAILED",
        httpStatus: response.status,
        networkPhase: "BEFORE_SEND",
        message: "LinkedIn authorization could not be completed.",
        retryAfterSeconds: null,
        details: { status: response.status },
      });
    }

    const expiresIn = typeof json.expires_in === "number" ? json.expires_in : null;
    const scopeRaw = typeof json.scope === "string" ? json.scope : "";
    return {
      accessToken: json.access_token,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      grantedScopes: scopeRaw.split(/[ ,]+/).map((item) => item.trim()).filter(Boolean),
      refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    };
  }

  async getIdentity(accessToken: string): Promise<LinkedinIdentity> {
    const response = await fetch(`${getLinkedinApiBaseUrl()}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await safeJson(response)) as Record<string, unknown> | null;
    if (!response.ok || !json || typeof json.sub !== "string") {
      throw new LinkedinProviderRequestError({
        code: "IDENTITY_FAILED",
        httpStatus: response.status,
        networkPhase: "BEFORE_SEND",
        message: "LinkedIn identity could not be read.",
        retryAfterSeconds: null,
        details: { status: response.status },
      });
    }
    return {
      providerSubject: json.sub,
      displayName: typeof json.name === "string" ? json.name : null,
      email: typeof json.email === "string" ? json.email : null,
      profileImageUrl: typeof json.picture === "string" ? json.picture : null,
    };
  }

  async publishPost(accessToken: string, input: LinkedinPublishPostInput): Promise<LinkedinPublishPostResult> {
    const response = await fetch(`${getLinkedinApiBaseUrl()}/rest/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": getLinkedinRestVersion(),
        "X-Restli-Protocol-Version": "2.0.0",
        "X-RestLi-Request-Id": input.providerRequestId,
      },
      body: JSON.stringify({
        author: input.authorUrn.startsWith("urn:") ? input.authorUrn : `urn:li:person:${input.authorUrn}`,
        commentary: input.text,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });

    if (!response.ok) {
      throw new LinkedinProviderRequestError({
        code: "PUBLISH_FAILED",
        httpStatus: response.status,
        networkPhase: response.status >= 500 ? "AFTER_POSSIBLE_SEND" : "BEFORE_SEND",
        message: "LinkedIn did not accept this post.",
        retryAfterSeconds: readRetryAfter(response),
        details: { status: response.status },
      });
    }

    const restliId = response.headers.get("x-restli-id") ?? response.headers.get("X-RestLi-Id");
    const json = (await safeJson(response)) as Record<string, unknown> | null;
    const fromBody = json && typeof json.id === "string" ? json.id : null;
    const externalPostId = restliId || fromBody;
    if (!externalPostId) {
      throw new LinkedinProviderRequestError({
        code: "MALFORMED_CREATE",
        httpStatus: response.status,
        networkPhase: "AFTER_POSSIBLE_SEND",
        message: "LinkedIn create response did not include a post id.",
        retryAfterSeconds: null,
        details: { status: response.status },
      });
    }

    return {
      externalPostId,
      externalUrl: null,
      rawStatus: response.status,
    };
  }

  async revokeConnection(accessToken: string): Promise<void> {
    const clientId = getLinkedinClientId();
    const clientSecret = getLinkedinClientSecret();
    if (!clientId || !clientSecret) return;
    try {
      await fetch(LINKEDIN_OAUTH_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: accessToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
    } catch {
      // Local token erasure still proceeds even if remote revoke fails.
    }
  }

  async getPostAnalytics(_accessToken: string, _externalPostId: string): Promise<LinkedinPostAnalytics> {
    void _accessToken;
    void _externalPostId;
    throw new LinkedinProviderRequestError({
      code: "ANALYTICS_NOT_APPROVED",
      httpStatus: 403,
      networkPhase: "BEFORE_SEND",
      message: "Official member post analytics are not enabled for this CareerOS app.",
      retryAfterSeconds: null,
      details: null,
    });
  }

  async getProfileAnalytics(_accessToken: string): Promise<LinkedinProfileAnalytics> {
    void _accessToken;
    throw new LinkedinProviderRequestError({
      code: "ANALYTICS_NOT_APPROVED",
      httpStatus: 403,
      networkPhase: "BEFORE_SEND",
      message: "Official member profile analytics are not enabled for this CareerOS app.",
      retryAfterSeconds: null,
      details: null,
    });
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readRetryAfter(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds : null;
}
