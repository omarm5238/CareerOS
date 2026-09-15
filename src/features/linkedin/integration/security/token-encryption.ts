import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "v1";

function getEncryptionKey(): Buffer {
  const raw = process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY is required to store LinkedIn tokens.");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const fromBase64 = Buffer.from(raw, "base64");
  if (fromBase64.length === 32) return fromBase64;
  throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY must be 32 bytes as hex or base64.");
}

export function encryptLinkedinSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decryptLinkedinSecret(payload: string): string {
  const [prefix, ivPart, cipherPart, tagPart] = payload.split(".");
  if (prefix !== PREFIX || !ivPart || !cipherPart || !tagPart) {
    throw new Error("Invalid encrypted LinkedIn secret payload.");
  }
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptedLinkedinSecret(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(`${PREFIX}.`) && value.split(".").length === 4;
}
