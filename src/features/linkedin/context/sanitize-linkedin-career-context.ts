import { isRecord } from "../lib/json-parsers";

const FORBIDDEN_KEY_PATTERN =
  /(salary|compensation|pay|workauthorization|work_authorization|visa|sponsorship|demographic|gender|ethnicity|race|religion|password|mfa|otp|secret|clearance|authorization|rejection|private.?note|recruiter.?contact|recruiter.?message|applicationid|application_id|auth.?token)/i;

const FORBIDDEN_VALUE_PATTERN =
  /\b(salary|compensation|visa|sponsorship|work authorization|security clearance|password|mfa|otp|ssn)\b/i;

export const LINKEDIN_FORBIDDEN_CONTEXT_KEYS = [
  "salary",
  "workAuthorization",
  "visa",
  "demographics",
  "password",
  "mfa",
  "private recruiter contacts",
  "private rejection notes",
  "application internal notes",
] as const;

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERN.test(key.replace(/[\s_-]+/g, ""));
}

export function sanitizeLinkedinCareerContext<T>(value: T): T {
  return sanitizeValue(value, "") as T;
}

function sanitizeValue(value: unknown, keyPath: string): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item, keyPath))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (isForbiddenKey(key)) continue;
      const sanitized = sanitizeValue(child, `${keyPath}.${key}`);
      if (sanitized !== undefined) next[key] = sanitized;
    }
    return next;
  }

  if (typeof value === "string") {
    if (FORBIDDEN_VALUE_PATTERN.test(value) && !keyPath.includes("userAuthoredPost")) {
      return undefined;
    }
    return value;
  }

  return value;
}

export function inspectSanitizedContext(value: unknown): {
  forbiddenKeysPresent: string[];
  looksClean: boolean;
} {
  const found = new Set<string>();
  walk(value, (key) => {
    if (isForbiddenKey(key)) found.add(key);
  });
  return {
    forbiddenKeysPresent: [...found],
    looksClean: found.size === 0,
  };
}

function walk(value: unknown, visit: (key: string) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    visit(key);
    walk(child, visit);
  }
}
