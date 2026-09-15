import type { LinkedinCapabilityView } from "../capabilities/types";

export type LinkedinTokenState = "NONE" | "VALID" | "EXPIRING_SOON" | "EXPIRED" | "REVOKED" | "INVALID";

export type LinkedinConnectionStatusView =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "REAUTH_REQUIRED"
  | "CONNECTION_ERROR"
  | "DISCONNECTING";

export type LinkedinConnectionView = {
  status: LinkedinConnectionStatusView;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  connectedAt: string | null;
  lastValidatedAt: string | null;
  reauthRequiredAt: string | null;
  tokenState: LinkedinTokenState;
  reauthRequired: boolean;
  capabilities: LinkedinCapabilityView[];
};
