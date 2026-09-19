import { createHash } from "node:crypto";

export function sha256Short(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function contextFingerprint(parts: Record<string, unknown>): string {
  return sha256Short(JSON.stringify(parts));
}

export function insightFingerprint(parts: {
  type: string;
  category: string;
  identity: string;
}): string {
  return [parts.type, parts.category, parts.identity].join(":");
}

export function recommendationFingerprint(parts: {
  category: string;
  intent: string;
  identity: string;
}): string {
  return [parts.category, parts.intent, parts.identity].join(":");
}
