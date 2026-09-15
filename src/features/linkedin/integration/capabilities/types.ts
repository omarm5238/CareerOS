export const LINKEDIN_CAPABILITY_IDS = [
  "IDENTITY",
  "EMAIL",
  "PUBLISH_MEMBER_POST",
  "POST_ANALYTICS",
  "PROFILE_ANALYTICS",
  "HISTORICAL_POST_READ",
  "COMMENTS_READ",
  "REACTIONS_READ",
  "ORGANIZATION_PUBLISH",
] as const;

export type LinkedinCapabilityId = (typeof LINKEDIN_CAPABILITY_IDS)[number];

export type LinkedinCapabilityState =
  | "AVAILABLE"
  | "AVAILABLE_NOT_GRANTED"
  | "APPROVAL_REQUIRED"
  | "RESTRICTED"
  | "UNSUPPORTED"
  | "TEMPORARILY_UNAVAILABLE";

export type LinkedinCapabilityRecoveryAction =
  | "CONNECT"
  | "RECONNECT"
  | "GRANT_PERMISSION"
  | "MANUAL_FALLBACK"
  | "NONE";

export type LinkedinCapabilityView = {
  capability: LinkedinCapabilityId;
  state: LinkedinCapabilityState;
  reason: string;
  recoveryAction: LinkedinCapabilityRecoveryAction | null;
};

export type LinkedinCapabilityMap = Record<LinkedinCapabilityId, LinkedinCapabilityView>;
