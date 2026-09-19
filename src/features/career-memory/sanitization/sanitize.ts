const SECRET_KEYS =
  /password|token|secret|authorization|apikey|api_key|mfa|otp|sessionid|session_id|refresh_token|access_token|id_token|private_key|encryption/i;
const SECRET_VALUES =
  /\b(sk-|Bearer\s+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}|AKIA[0-9A-Z]{16})\b/i;
const CONTACT_VALUES = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function looksSensitive(value: string): boolean {
  return SECRET_VALUES.test(value) || CONTACT_VALUES.test(value);
}

export function sanitizeEvidence(value: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SECRET_KEYS.test(key)) continue;
    if (typeof raw === "string") {
      if (looksSensitive(raw) || raw.length > 240) continue;
      out[key] = raw.slice(0, 180);
      continue;
    }
    if (typeof raw === "number" || typeof raw === "boolean" || raw === null) {
      out[key] = raw;
      continue;
    }
    if (Array.isArray(raw)) {
      out[key] = raw
        .filter((item) => typeof item === "string" || typeof item === "number")
        .slice(0, 12);
    }
  }
  return out;
}

export function sanitizeNormalizedText(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!cleaned || looksSensitive(cleaned)) {
    throw new Error("sensitive");
  }
  return cleaned;
}

export function isBlockedManualValue(value: string): boolean {
  return looksSensitive(value) || /<script|javascript:|onerror=/i.test(value);
}
