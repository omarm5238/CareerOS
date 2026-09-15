import type { LinkedinConnectionStatus } from "@/generated/prisma/client";

import { isLinkedinAnalyticsAppApproved } from "../config";
import { getLinkedinTokenState, isUsableLinkedinToken } from "../connection/token-state";
import type {
  LinkedinCapabilityId,
  LinkedinCapabilityMap,
  LinkedinCapabilityRecoveryAction,
  LinkedinCapabilityState,
  LinkedinCapabilityView,
} from "./types";
import { LINKEDIN_CAPABILITY_IDS } from "./types";

const PUBLISH_SCOPES = ["w_member_social"];
const EMAIL_SCOPES = ["email"];
const POST_ANALYTICS_SCOPES = ["r_member_postAnalytics"];
const PROFILE_ANALYTICS_SCOPES = ["r_member_profileAnalytics"];

export function resolveLinkedinCapabilities(input: {
  connectionStatus: LinkedinConnectionStatus | null;
  encryptedAccessToken?: string | null;
  tokenExpiresAt?: Date | null;
  grantedScopes: string[];
  analyticsApproved?: boolean;
}): LinkedinCapabilityMap {
  const connectionStatus = input.connectionStatus;
  const tokenState = connectionStatus
    ? getLinkedinTokenState({
        status: connectionStatus,
        encryptedAccessToken: input.encryptedAccessToken ?? null,
        tokenExpiresAt: input.tokenExpiresAt ?? null,
      })
    : "NONE";
  const connected = connectionStatus === "CONNECTED";
  const usable = connected && isUsableLinkedinToken(tokenState);
  const scopes = new Set(input.grantedScopes);
  const analyticsApproved = input.analyticsApproved ?? isLinkedinAnalyticsAppApproved();

  const identity = capability(
    "IDENTITY",
    usable ? "AVAILABLE" : connectionStatus ? connectionDerived(connectionStatus, tokenState) : "TEMPORARILY_UNAVAILABLE",
    usable
      ? "Connected LinkedIn account identity is available."
      : connectionReason(connectionStatus, tokenState, "identity"),
    usable ? null : recovery(connectionStatus, tokenState),
  );

  const emailGranted = scopes.has("email") || EMAIL_SCOPES.some((scope) => scopes.has(scope));
  const email = capability(
    "EMAIL",
    !usable
      ? connectionDerived(connectionStatus, tokenState)
      : emailGranted
        ? "AVAILABLE"
        : "AVAILABLE_NOT_GRANTED",
    !usable
      ? connectionReason(connectionStatus, tokenState, "email")
      : emailGranted
        ? "Email was granted by the connected LinkedIn account."
        : "Email was not granted. Reconnect and grant email if you want it stored.",
    !usable ? recovery(connectionStatus, tokenState) : emailGranted ? null : "GRANT_PERMISSION",
  );

  const publishGranted = PUBLISH_SCOPES.some((scope) => scopes.has(scope));
  const publishState: LinkedinCapabilityState = !usable
    ? connectionDerived(connectionStatus, tokenState)
    : publishGranted
      ? "AVAILABLE"
      : "AVAILABLE_NOT_GRANTED";
  const publish = capability(
    "PUBLISH_MEMBER_POST",
    publishState,
    !usable
      ? connectionReason(connectionStatus, tokenState, "official publishing")
      : publishGranted
        ? "Official member post publishing is available."
        : "CareerOS does not currently have permission to publish to LinkedIn.",
    !usable ? recovery(connectionStatus, tokenState) : publishGranted ? null : "GRANT_PERMISSION",
  );

  const postAnalytics = analyticsCapability(
    "POST_ANALYTICS",
    usable,
    connectionStatus,
    tokenState,
    analyticsApproved,
    POST_ANALYTICS_SCOPES.some((scope) => scopes.has(scope)),
    "Official LinkedIn post analytics",
  );
  const profileAnalytics = analyticsCapability(
    "PROFILE_ANALYTICS",
    usable,
    connectionStatus,
    tokenState,
    analyticsApproved,
    PROFILE_ANALYTICS_SCOPES.some((scope) => scopes.has(scope)),
    "Official LinkedIn profile analytics",
  );

  const historical = capability(
    "HISTORICAL_POST_READ",
    "RESTRICTED",
    "Historical personal post import is not available through CareerOS LinkedIn access.",
    "MANUAL_FALLBACK",
  );
  const comments = capability(
    "COMMENTS_READ",
    "RESTRICTED",
    "Reading LinkedIn comments is not available through CareerOS LinkedIn access.",
    "NONE",
  );
  const reactions = capability(
    "REACTIONS_READ",
    "RESTRICTED",
    "Reading LinkedIn reactions is not available through CareerOS LinkedIn access.",
    "NONE",
  );
  const org = capability(
    "ORGANIZATION_PUBLISH",
    "UNSUPPORTED",
    "Organization page publishing is not supported yet.",
    "NONE",
  );

  return {
    IDENTITY: identity,
    EMAIL: email,
    PUBLISH_MEMBER_POST: publish,
    POST_ANALYTICS: postAnalytics,
    PROFILE_ANALYTICS: profileAnalytics,
    HISTORICAL_POST_READ: historical,
    COMMENTS_READ: comments,
    REACTIONS_READ: reactions,
    ORGANIZATION_PUBLISH: org,
  };
}

export function capabilityList(map: LinkedinCapabilityMap): LinkedinCapabilityView[] {
  return LINKEDIN_CAPABILITY_IDS.map((id) => map[id]);
}

export function snapshotCapabilities(map: LinkedinCapabilityMap): Record<string, LinkedinCapabilityState> {
  return Object.fromEntries(LINKEDIN_CAPABILITY_IDS.map((id) => [id, map[id].state])) as Record<
    string,
    LinkedinCapabilityState
  >;
}

function analyticsCapability(
  id: LinkedinCapabilityId,
  usable: boolean,
  connectionStatus: LinkedinConnectionStatus | null,
  tokenState: ReturnType<typeof getLinkedinTokenState>,
  approved: boolean,
  granted: boolean,
  label: string,
): LinkedinCapabilityView {
  if (!approved) {
    return capability(
      id,
      "APPROVAL_REQUIRED",
      `${label} require additional LinkedIn API approval. Manual performance tracking remains available.`,
      "NONE",
    );
  }
  if (!usable) {
    return capability(
      id,
      connectionDerived(connectionStatus, tokenState),
      connectionReason(connectionStatus, tokenState, label),
      recovery(connectionStatus, tokenState),
    );
  }
  if (!granted) {
    return capability(
      id,
      "AVAILABLE_NOT_GRANTED",
      `Reconnect to grant the required analytics permission.`,
      "GRANT_PERMISSION",
    );
  }
  return capability(id, "AVAILABLE", `${label} are available.`, null);
}

function connectionDerived(
  status: LinkedinConnectionStatus | null,
  tokenState: ReturnType<typeof getLinkedinTokenState>,
): LinkedinCapabilityState {
  if (!status || status === "DISCONNECTED") return "TEMPORARILY_UNAVAILABLE";
  if (status === "REAUTH_REQUIRED" || tokenState === "EXPIRED" || tokenState === "REVOKED") {
    return "TEMPORARILY_UNAVAILABLE";
  }
  if (status === "CONNECTION_ERROR" || status === "CONNECTING" || status === "DISCONNECTING") {
    return "TEMPORARILY_UNAVAILABLE";
  }
  return "TEMPORARILY_UNAVAILABLE";
}

function connectionReason(
  status: LinkedinConnectionStatus | null,
  tokenState: ReturnType<typeof getLinkedinTokenState>,
  label: string,
): string {
  if (!status || status === "DISCONNECTED") return `Connect your LinkedIn account to use ${label}.`;
  if (status === "REAUTH_REQUIRED" || tokenState === "EXPIRED" || tokenState === "REVOKED") {
    return "Your LinkedIn authorization is no longer valid. Reconnect to continue.";
  }
  if (status === "CONNECTING") return "LinkedIn connection is still completing.";
  if (status === "CONNECTION_ERROR") return "The LinkedIn connection needs attention before this capability can be used.";
  return `${label} is temporarily unavailable.`;
}

function recovery(
  status: LinkedinConnectionStatus | null,
  tokenState: ReturnType<typeof getLinkedinTokenState>,
): LinkedinCapabilityRecoveryAction {
  if (!status || status === "DISCONNECTED") return "CONNECT";
  if (status === "REAUTH_REQUIRED" || tokenState === "EXPIRED" || tokenState === "REVOKED") return "RECONNECT";
  return "MANUAL_FALLBACK";
}

function capability(
  id: LinkedinCapabilityId,
  state: LinkedinCapabilityState,
  reason: string,
  recoveryAction: LinkedinCapabilityRecoveryAction | null,
): LinkedinCapabilityView {
  return { capability: id, state, reason, recoveryAction };
}
