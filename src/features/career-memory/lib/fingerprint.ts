import { createHash } from "node:crypto";

import type { CareerMemoryCategory, CareerMemoryType } from "../types";

export function sha256Short(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}

export function semanticMemoryKey(parts: {
  type: CareerMemoryType;
  category: CareerMemoryCategory;
  subjectKey: string;
  normalizedValueKey: string;
}): string {
  return [parts.type, parts.category, parts.subjectKey, parts.normalizedValueKey].join(":");
}

export function evidenceFingerprint(parts: {
  sourceSubsystem: string;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  sourceEventId?: string | null;
  semantic: string;
}): string {
  return sha256Short(
    [
      parts.sourceSubsystem,
      parts.sourceEntityType ?? "",
      parts.sourceEntityId ?? "",
      parts.sourceEventId ?? "",
      parts.semantic,
    ].join("|"),
  );
}

export function relationFingerprint(parts: {
  relationType: string;
  fromKey: string;
  toKey: string;
}): string {
  return sha256Short([parts.relationType, parts.fromKey, parts.toKey].join("|"));
}
