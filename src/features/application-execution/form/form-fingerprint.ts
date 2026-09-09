import { createHash } from "node:crypto";

import type { ApplicationFormSnapshot } from "../types";
import { normalizeLabel } from "../classification/classify-application-field";

function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.delete("_");
    parsed.searchParams.delete("t");
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

export function buildFormFingerprint(snapshot: ApplicationFormSnapshot, jobContext: string): string {
  const payload = {
    provider: snapshot.provider,
    url: canonicalUrl(snapshot.pageUrl),
    jobContext,
    step: snapshot.step,
    totalSteps: snapshot.totalSteps,
    fields: snapshot.fields.map((field) => ({
      id: field.externalId,
      label: normalizeLabel(field.normalizedLabel || field.label),
      type: field.type,
      required: field.required,
      options: field.options.map((option) => option.value).sort(),
    })),
    submit: snapshot.submitControl
      ? { label: normalizeLabel(snapshot.submitControl.label), isFinal: snapshot.submitControl.isFinal }
      : null,
    next: snapshot.nextControl ? { label: normalizeLabel(snapshot.nextControl.label) } : null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function hashValue(value: string | boolean | null): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
