import { LINKEDIN_OAUTH_AUTHORIZE_URL } from "../config";
import {
  LinkedinProviderRequestError,
  type LinkedinApiClient,
  type LinkedinAuthorizationRequest,
  type LinkedinFixtureScenario,
  type LinkedinIdentity,
  type LinkedinPostAnalytics,
  type LinkedinProfileAnalytics,
  type LinkedinPublishPostInput,
  type LinkedinPublishPostResult,
  type LinkedinTokenExchangeResult,
} from "./types";

const FIXTURE_TOKEN_PREFIX = "fixture-token:";
export const FIXTURE_DEFAULT_SUBJECT = "urn:li:person:fixture-user";
export const FIXTURE_ALT_SUBJECT = "urn:li:person:fixture-other";

let publishCallCount = 0;

export function resetFixtureLinkedinClient(): void {
  publishCallCount = 0;
}

export function getFixturePublishCallCount(): number {
  return publishCallCount;
}

export function encodeFixtureAccessToken(scenario: LinkedinFixtureScenario, subject = FIXTURE_DEFAULT_SUBJECT): string {
  return `${FIXTURE_TOKEN_PREFIX}${scenario}:${subject}`;
}

export function parseFixtureAccessToken(accessToken: string): { scenario: LinkedinFixtureScenario; subject: string } {
  if (!accessToken.startsWith(FIXTURE_TOKEN_PREFIX)) {
    return { scenario: "SUCCESS", subject: FIXTURE_DEFAULT_SUBJECT };
  }
  const rest = accessToken.slice(FIXTURE_TOKEN_PREFIX.length);
  const [scenario, ...subjectParts] = rest.split(":");
  return {
    scenario: (scenario as LinkedinFixtureScenario) || "SUCCESS",
    subject: subjectParts.join(":") || FIXTURE_DEFAULT_SUBJECT,
  };
}

export function isFixtureAuthorizationCode(code: string): boolean {
  return code.startsWith("fixture.");
}

export class FixtureLinkedinApiClient implements LinkedinApiClient {
  readonly mode = "fixture" as const;

  getAuthorizationUrl(input: LinkedinAuthorizationRequest): string {
    const url = new URL(input.redirectUri);
    url.searchParams.set("state", input.state);
    url.searchParams.set("code", "fixture.SUCCESS");
    return url.toString();
  }

  async exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<LinkedinTokenExchangeResult> {
    void input.redirectUri;
    void input.codeVerifier;
    const scenario = scenarioFromCode(input.code);
    if (scenario === "UNAUTHORIZED") {
      throw providerError("UNAUTHORIZED", 401, "BEFORE_SEND", "Fixture token exchange unauthorized.");
    }
    const expiresAt =
      scenario === "TOKEN_EXPIRED" ? new Date(Date.now() - 60_000) : new Date(Date.now() + 60 * 60 * 1000);
    const scopes =
      scenario === "MISSING_SCOPE" ? ["openid", "profile", "email"] : ["openid", "profile", "email", "w_member_social"];
    const subject = scenario === "ACCOUNT_MISMATCH" ? FIXTURE_ALT_SUBJECT : FIXTURE_DEFAULT_SUBJECT;
    return {
      accessToken: encodeFixtureAccessToken(scenario, subject),
      expiresAt,
      grantedScopes: scopes,
      refreshToken: null,
    };
  }

  async getIdentity(accessToken: string): Promise<LinkedinIdentity> {
    const parsed = parseFixtureAccessToken(accessToken);
    if (parsed.scenario === "UNAUTHORIZED") {
      throw providerError("UNAUTHORIZED", 401, "BEFORE_SEND", "Fixture identity unauthorized.");
    }
    return {
      providerSubject: parsed.subject,
      displayName: parsed.subject === FIXTURE_ALT_SUBJECT ? "Other Fixture" : "Fixture Member",
      email: parsed.scenario === "MISSING_SCOPE" ? null : "fixture-member@careeros.local",
      profileImageUrl: "https://example.invalid/linkedin-fixture.png",
    };
  }

  async publishPost(accessToken: string, input: LinkedinPublishPostInput): Promise<LinkedinPublishPostResult> {
    const parsed = parseFixtureAccessToken(accessToken);
    publishCallCount += 1;
    switch (parsed.scenario) {
      case "TIMEOUT_BEFORE_SEND":
        publishCallCount -= 1;
        throw providerError("TIMEOUT", 408, "BEFORE_SEND", "Fixture timeout before send.");
      case "API_UNAVAILABLE_BEFORE_SEND":
        publishCallCount -= 1;
        throw providerError("UNAVAILABLE", 503, "BEFORE_SEND", "Fixture API unavailable before send.");
      case "TIMEOUT_AFTER_SEND":
        throw providerError("TIMEOUT", 408, "AFTER_POSSIBLE_SEND", "Fixture timeout after send.");
      case "API_UNAVAILABLE_AFTER_SEND":
        throw providerError("UNAVAILABLE", 503, "AFTER_POSSIBLE_SEND", "Fixture API unavailable after send.");
      case "MALFORMED_RESPONSE":
        throw providerError("MALFORMED", 201, "AFTER_POSSIBLE_SEND", "Fixture malformed create response.");
      case "AMBIGUOUS_RESPONSE":
        throw providerError("AMBIGUOUS", 500, "AFTER_POSSIBLE_SEND", "Fixture ambiguous 5xx after possible create.");
      case "DEFINITE_REJECTION":
        throw providerError("REJECTED", 400, "BEFORE_SEND", "Fixture definite content rejection.");
      case "UNAUTHORIZED":
      case "TOKEN_EXPIRED":
        throw providerError("UNAUTHORIZED", 401, "BEFORE_SEND", "Fixture token expired or invalid.");
      case "MISSING_SCOPE":
      case "FORBIDDEN":
        throw providerError("FORBIDDEN", 403, "BEFORE_SEND", "Fixture missing publish permission.");
      case "RATE_LIMITED":
        throw providerError("RATE_LIMITED", 429, "BEFORE_SEND", "Fixture rate limited before create.");
      default:
        return {
          externalPostId: `urn:li:share:fixture-${input.contentFingerprint.slice(0, 12)}`,
          externalUrl: null,
          rawStatus: 201,
        };
    }
  }

  async revokeConnection(accessToken: string): Promise<void> {
    void accessToken;
  }

  async getPostAnalytics(accessToken: string, externalPostId: string): Promise<LinkedinPostAnalytics> {
    void externalPostId;
    const parsed = parseFixtureAccessToken(accessToken);
    if (parsed.scenario !== "SUCCESS") {
      throw providerError("FORBIDDEN", 403, "BEFORE_SEND", "Fixture analytics not available.");
    }
    return { impressions: 120, views: 80, likes: 4, comments: 1, reposts: 0, saves: 2 };
  }

  async getProfileAnalytics(accessToken: string): Promise<LinkedinProfileAnalytics> {
    const parsed = parseFixtureAccessToken(accessToken);
    if (parsed.scenario !== "SUCCESS") {
      throw providerError("FORBIDDEN", 403, "BEFORE_SEND", "Fixture profile analytics not available.");
    }
    return { profileViews: 17, newFollowers: 3 };
  }
}

function scenarioFromCode(code: string): LinkedinFixtureScenario {
  if (code.startsWith("fixture.")) {
    const name = code.slice("fixture.".length) as LinkedinFixtureScenario;
    return name || "SUCCESS";
  }
  return "SUCCESS";
}

function providerError(
  code: string,
  httpStatus: number,
  networkPhase: "BEFORE_SEND" | "AFTER_POSSIBLE_SEND",
  message: string,
) {
  return new LinkedinProviderRequestError({
    code,
    httpStatus,
    networkPhase,
    message,
    retryAfterSeconds: httpStatus === 429 ? 30 : null,
    details: { fixture: true },
  });
}

export { LINKEDIN_OAUTH_AUTHORIZE_URL };
