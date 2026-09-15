import type { LinkedinTokenState } from "./types";

export type { LinkedinTokenState };

export const LINKEDIN_TOKEN_EXPIRING_SOON_MS = 5 * 60 * 1000;

export function getLinkedinTokenState(connection: {
  status: string;
  encryptedAccessToken: string | null;
  tokenExpiresAt: Date | null;
}): LinkedinTokenState {
  if (connection.status === "DISCONNECTED" || connection.status === "DISCONNECTING") return "NONE";
  if (!connection.encryptedAccessToken) {
    return connection.status === "REAUTH_REQUIRED" ? "REVOKED" : "NONE";
  }
  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() <= Date.now()) return "EXPIRED";
  if (connection.status === "CONNECTION_ERROR") return "INVALID";
  if (connection.status === "REAUTH_REQUIRED") return "REVOKED";
  if (
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() <= Date.now() + LINKEDIN_TOKEN_EXPIRING_SOON_MS
  ) {
    return "EXPIRING_SOON";
  }
  if (connection.status === "CONNECTED" || connection.status === "CONNECTING") return "VALID";
  return "INVALID";
}

export function isUsableLinkedinToken(state: LinkedinTokenState): boolean {
  return state === "VALID" || state === "EXPIRING_SOON";
}
