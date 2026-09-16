import { createHash } from "node:crypto";

export function sha256Short(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function candidateFingerprint(parts: {
  type: string;
  sourceEntityType: string;
  sourceEntityId: string | null;
  intent: string;
}): string {
  return [
    parts.type,
    parts.sourceEntityType,
    parts.sourceEntityId ?? "none",
    parts.intent,
  ].join(":");
}

export function activityFingerprint(parts: string[]): string {
  return parts.filter(Boolean).join(":");
}

export function contextFingerprint(parts: Record<string, unknown>): string {
  return sha256Short(JSON.stringify(parts));
}
