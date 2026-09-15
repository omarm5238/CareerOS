import { createHash, randomBytes } from "node:crypto";

export function generateOauthState(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOauthState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export function generatePkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
