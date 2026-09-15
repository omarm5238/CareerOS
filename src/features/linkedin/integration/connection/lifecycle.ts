import { prisma } from "@/server/db/prisma";
import type { linkedinConnection } from "@/generated/prisma/client";

import { toPrismaJson } from "../../lib/json-parsers";
import { LinkedinAccessError } from "../../lib/permissions";
import { capabilityList, resolveLinkedinCapabilities, snapshotCapabilities } from "../capabilities/resolve-capabilities";
import type { LinkedinCapabilityMap } from "../capabilities/types";
import {
  areOfficialLinkedinCredentialsConfigured,
  getLinkedinProviderMode,
  getLinkedinRedirectUri,
  getRequestedLinkedinScopes,
  LINKEDIN_OAUTH_TTL_MS,
} from "../config";
import { LinkedinIntegrationError } from "../errors";
import { getLinkedinApiClient } from "../provider";
import { generateOauthState, generatePkceVerifier, hashOauthState, pkceChallengeFromVerifier } from "../security/oauth-state";
import { decryptLinkedinSecret, encryptLinkedinSecret } from "../security/token-encryption";
import { getLinkedinTokenState, isUsableLinkedinToken } from "./token-state";
import type { LinkedinConnectionView } from "./types";

export type { LinkedinConnectionView } from "./types";

export async function getLinkedinConnectionRecord(userId: string) {
  return prisma.linkedinConnection.findUnique({ where: { userId } });
}

export async function assertOwnedConnection(userId: string) {
  const row = await getLinkedinConnectionRecord(userId);
  if (!row) throw new LinkedinAccessError("NOT_FOUND", "LinkedIn connection not found.");
  return row;
}

export async function getSafeLinkedinConnection(userId: string): Promise<LinkedinConnectionView> {
  let row = await getLinkedinConnectionRecord(userId);
  if (row && getLinkedinTokenState(row) === "EXPIRED" && row.status === "CONNECTED") {
    row = await prisma.linkedinConnection.update({
      where: { id: row.id },
      data: { status: "REAUTH_REQUIRED", reauthRequiredAt: row.reauthRequiredAt ?? new Date() },
    });
  }
  return toConnectionView(row);
}

export function toConnectionView(row: linkedinConnection | null): LinkedinConnectionView {
  if (!row) {
    const capabilities = capabilityList(
      resolveLinkedinCapabilities({ connectionStatus: null, grantedScopes: [] }),
    );
    return {
      status: "DISCONNECTED",
      displayName: null,
      email: null,
      profileImageUrl: null,
      connectedAt: null,
      lastValidatedAt: null,
      reauthRequiredAt: null,
      tokenState: "NONE",
      reauthRequired: false,
      capabilities,
    };
  }

  const tokenState = getLinkedinTokenState(row);
  const status = tokenState === "EXPIRED" ? "REAUTH_REQUIRED" : row.status;
  const scopes = asScopeArray(row.grantedScopesJson);
  const capabilities = capabilityList(
    resolveLinkedinCapabilities({
      connectionStatus: status,
      encryptedAccessToken: row.encryptedAccessToken,
      tokenExpiresAt: row.tokenExpiresAt,
      grantedScopes: scopes,
    }),
  );

  return {
    status,
    displayName: row.displayName,
    email: row.email,
    profileImageUrl: row.profileImageUrl,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
    reauthRequiredAt: row.reauthRequiredAt?.toISOString() ?? null,
    tokenState,
    reauthRequired: tokenState === "EXPIRED" || status === "REAUTH_REQUIRED",
    capabilities,
  };
}

export async function startLinkedinConnection(userId: string, mode: "connect" | "reconnect" = "connect") {
  if (getLinkedinProviderMode() === "official" && !areOfficialLinkedinCredentialsConfigured()) {
    throw new LinkedinIntegrationError("LINKEDIN_CREDENTIALS_MISSING");
  }

  const existing = await getLinkedinConnectionRecord(userId);
  if (mode === "connect" && existing?.status === "CONNECTED" && isUsableLinkedinToken(getLinkedinTokenState(existing))) {
    // Reconnect is the explicit path for a live account; start still issues a new OAuth attempt.
  }

  const state = generateOauthState();
  const verifier = generatePkceVerifier();
  const redirectUri = getLinkedinRedirectUri();
  await prisma.linkedinOAuthAttempt.create({
    data: {
      userId,
      stateHash: hashOauthState(state),
      redirectUri,
      pkceVerifierEncrypted: encryptLinkedinSecret(verifier),
      expiresAt: new Date(Date.now() + LINKEDIN_OAUTH_TTL_MS),
    },
  });

  if (!existing) {
    await prisma.linkedinConnection.create({
      data: { userId, status: "CONNECTING" },
    });
  } else if (existing.status === "DISCONNECTED" || existing.status === "CONNECTION_ERROR") {
    await prisma.linkedinConnection.update({
      where: { id: existing.id },
      data: { status: "CONNECTING", disconnectedAt: null },
    });
  }

  const client = getLinkedinApiClient();
  const authorizationUrl = client.getAuthorizationUrl({
    state,
    redirectUri,
    scopes: getRequestedLinkedinScopes(),
    codeChallenge: pkceChallengeFromVerifier(verifier),
  });
  return { authorizationUrl };
}

export async function completeLinkedinOAuthCallback(userId: string, query: { state?: string | null; code?: string | null }) {
  const state = query.state?.trim() ?? "";
  const code = query.code?.trim() ?? "";
  if (!state) throw new LinkedinIntegrationError("LINKEDIN_OAUTH_STATE_INVALID", "Missing OAuth state.");
  if (!code) throw new LinkedinIntegrationError("LINKEDIN_OAUTH_STATE_INVALID", "Missing authorization code.");

  const attempt = await prisma.linkedinOAuthAttempt.findUnique({
    where: { stateHash: hashOauthState(state) },
  });
  if (!attempt || attempt.userId !== userId) {
    throw new LinkedinIntegrationError("LINKEDIN_OAUTH_STATE_INVALID");
  }
  if (attempt.usedAt) throw new LinkedinIntegrationError("LINKEDIN_OAUTH_STATE_INVALID", "This authorization request was already used.");
  if (attempt.expiresAt.getTime() <= Date.now()) {
    throw new LinkedinIntegrationError("LINKEDIN_OAUTH_EXPIRED");
  }
  if (!attempt.pkceVerifierEncrypted) {
    throw new LinkedinIntegrationError("LINKEDIN_OAUTH_STATE_INVALID");
  }

  await prisma.linkedinOAuthAttempt.update({
    where: { id: attempt.id },
    data: { usedAt: new Date() },
  });

  const client = getLinkedinApiClient();
  const verifier = decryptLinkedinSecret(attempt.pkceVerifierEncrypted);
  const tokens = await client.exchangeAuthorizationCode({
    code,
    redirectUri: attempt.redirectUri,
    codeVerifier: verifier,
  });
  const identity = await client.getIdentity(tokens.accessToken);
  const existing = await getLinkedinConnectionRecord(userId);
  if (
    existing?.providerSubject &&
    existing.status !== "DISCONNECTED" &&
    existing.providerSubject !== identity.providerSubject
  ) {
    await prisma.linkedinConnection.update({
      where: { id: existing.id },
      data: { status: existing.status === "CONNECTING" ? "CONNECTION_ERROR" : existing.status },
    });
    throw new LinkedinIntegrationError("LINKEDIN_ACCOUNT_MISMATCH");
  }

  const capabilities = resolveLinkedinCapabilities({
    connectionStatus: "CONNECTED",
    encryptedAccessToken: "present",
    tokenExpiresAt: tokens.expiresAt,
    grantedScopes: tokens.grantedScopes,
  });
  const now = new Date();
  const data = {
    providerSubject: identity.providerSubject,
    displayName: identity.displayName,
    email: identity.email,
    profileImageUrl: identity.profileImageUrl,
    status: "CONNECTED" as const,
    encryptedAccessToken: encryptLinkedinSecret(tokens.accessToken),
    tokenExpiresAt: tokens.expiresAt,
    grantedScopesJson: toPrismaJson(tokens.grantedScopes),
    capabilitySnapshotJson: toPrismaJson(snapshotCapabilities(capabilities)),
    connectedAt: existing?.connectedAt ?? now,
    lastValidatedAt: now,
    reauthRequiredAt: null,
    disconnectedAt: null,
  };

  const row = existing
    ? await prisma.linkedinConnection.update({ where: { id: existing.id }, data })
    : await prisma.linkedinConnection.create({ data: { userId, ...data } });

  return toConnectionView(row);
}

export async function disconnectLinkedinConnection(userId: string) {
  const existing = await getLinkedinConnectionRecord(userId);
  if (!existing || existing.status === "DISCONNECTED") {
    return toConnectionView(existing);
  }

  await prisma.linkedinConnection.update({
    where: { id: existing.id },
    data: { status: "DISCONNECTING" },
  });

  if (existing.encryptedAccessToken) {
    try {
      const token = decryptLinkedinSecret(existing.encryptedAccessToken);
      await getLinkedinApiClient().revokeConnection?.(token);
    } catch {
      // Local erasure is mandatory even when remote revoke fails.
    }
  }

  const row = await prisma.linkedinConnection.update({
    where: { id: existing.id },
    data: {
      status: "DISCONNECTED",
      encryptedAccessToken: null,
      tokenExpiresAt: null,
      disconnectedAt: new Date(),
      reauthRequiredAt: null,
    },
  });
  return toConnectionView(row);
}

export async function reconnectLinkedinConnection(userId: string) {
  return startLinkedinConnection(userId, "reconnect");
}

export async function refreshLinkedinConnectionMetadata(userId: string) {
  const existing = await assertOwnedConnection(userId);
  const tokenState = getLinkedinTokenState(existing);
  if (!isUsableLinkedinToken(tokenState) || !existing.encryptedAccessToken) {
    if (tokenState === "EXPIRED") {
      const row = await prisma.linkedinConnection.update({
        where: { id: existing.id },
        data: { status: "REAUTH_REQUIRED", reauthRequiredAt: existing.reauthRequiredAt ?? new Date() },
      });
      return toConnectionView(row);
    }
    return toConnectionView(existing);
  }

  const token = decryptLinkedinSecret(existing.encryptedAccessToken);
  const identity = await getLinkedinApiClient().getIdentity(token);
  const capabilities = currentCapabilities(existing);
  const row = await prisma.linkedinConnection.update({
    where: { id: existing.id },
    data: {
      displayName: identity.displayName,
      email: identity.email,
      profileImageUrl: identity.profileImageUrl,
      lastValidatedAt: new Date(),
      capabilitySnapshotJson: toPrismaJson(snapshotCapabilities(capabilities)),
    },
  });
  return toConnectionView(row);
}

export function currentCapabilities(row: linkedinConnection | null): LinkedinCapabilityMap {
  return resolveLinkedinCapabilities({
    connectionStatus: row?.status ?? null,
    encryptedAccessToken: row?.encryptedAccessToken ?? null,
    tokenExpiresAt: row?.tokenExpiresAt ?? null,
    grantedScopes: asScopeArray(row?.grantedScopesJson),
  });
}

export function asScopeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function readDecryptedAccessToken(row: linkedinConnection): Promise<string | null> {
  if (!row.encryptedAccessToken) return null;
  return decryptLinkedinSecret(row.encryptedAccessToken);
}

export async function markConnectionReauthRequired(connectionId: string) {
  await prisma.linkedinConnection.update({
    where: { id: connectionId },
    data: { status: "REAUTH_REQUIRED", reauthRequiredAt: new Date() },
  });
}

export { encodeFixtureAccessToken, parseFixtureAccessToken } from "../provider/fixture-client";
