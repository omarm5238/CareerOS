import type { Prisma } from "@/generated/prisma/client";

import type {
  LinkedinEvidenceItem,
  LinkedinEvidenceKind,
  LinkedinProfileSnapshot,
  LinkedinWarning,
} from "../types";
import { LINKEDIN_EVIDENCE_KINDS, LINKEDIN_EVIDENCE_STRENGTHS } from "../types";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asStringArray(value: unknown, limit = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

export function clipText(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trimEnd()}…`;
}

export function parseWarnings(value: unknown): LinkedinWarning[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        const message = item.trim();
        return message ? { code: "general", message: clipText(message, 240) } : null;
      }
      if (!isRecord(item)) return null;
      const message = (asString(item.message) ?? "").trim();
      if (!message) return null;
      return {
        code: clipText(asString(item.code) ?? "general", 64),
        message: clipText(message, 240),
      };
    })
    .filter((item): item is LinkedinWarning => item !== null)
    .slice(0, 12);
}

export function parseEvidenceItems(value: unknown): LinkedinEvidenceItem[] {
  if (!Array.isArray(value)) return [];
  const items: LinkedinEvidenceItem[] = [];
  for (const [index, raw] of value.entries()) {
    if (!isRecord(raw)) continue;
    const label = (asString(raw.label) ?? "").trim();
    const kind = asEnum<LinkedinEvidenceKind>(raw.kind, LINKEDIN_EVIDENCE_KINDS);
    if (!label || !kind) continue;
    items.push({
      id: (asString(raw.id) ?? `evidence-${index + 1}`).slice(0, 80),
      kind,
      label: clipText(label, 180),
      detail: asString(raw.detail) ? clipText(raw.detail as string, 280) : undefined,
      strength: asEnum(raw.strength, LINKEDIN_EVIDENCE_STRENGTHS) ?? undefined,
    });
    if (items.length >= 16) break;
  }
  return items;
}

export function parseProfileSnapshot(value: unknown): LinkedinProfileSnapshot | null {
  if (!isRecord(value)) return null;
  return {
    headline: asString(value.headline),
    about: asString(value.about),
    currentRole: asString(value.currentRole),
    featuredItems: asStringArray(value.featuredItems, 8),
    topSkills: asStringArray(value.topSkills, 12),
  };
}

export function parseGoalList(value: unknown): string[] {
  return asStringArray(value, 8);
}
