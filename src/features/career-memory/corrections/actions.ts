import { prisma } from "@/server/db/prisma";

import { CareerMemoryAccessError } from "../errors";
import { computeConfidenceScore } from "../confidence/score";
import { deactivateRelationsForMemory, upsertGraphFromSuggestions } from "../graph/sync";
import { entityCanonical } from "../lib/canonical";
import { evidenceFingerprint, semanticMemoryKey } from "../lib/fingerprint";
import { toPrismaJson } from "../lib/json";
import { isBlockedManualValue, sanitizeNormalizedText } from "../sanitization/sanitize";
import type { CareerMemoryCategory, CareerMemoryType } from "../types";

async function ownedActive(userId: string, id: string) {
  const memory = await prisma.careerMemory.findFirst({
    where: { id, userId },
    include: { evidence: true },
  });
  if (!memory) throw new CareerMemoryAccessError("NOT_FOUND", "Memory not found.");
  return memory;
}

async function audit(userId: string, careerMemoryId: string | null, eventType: "CONFIRMED" | "USER_CORRECTED" | "EXPIRED" | "SUPPRESSED" | "RESTORED" | "DELETED", reason: string) {
  await prisma.careerMemoryEvent.create({
    data: { userId, careerMemoryId, eventType, reason, source: "USER_DECLARED" },
  });
}

export async function confirmCareerMemory(userId: string, id: string) {
  const memory = await ownedActive(userId, id);
  if (memory.status !== "ACTIVE") throw new CareerMemoryAccessError("CONFLICT", "Only active memory can be confirmed.");
  const fingerprint = evidenceFingerprint({
    sourceSubsystem: "USER_DECLARED",
    sourceEventId: `confirm:${id}:${Date.now()}`,
    semantic: memory.semanticKey,
  });
  await prisma.careerMemoryEvidence.create({
    data: {
      userId,
      careerMemoryId: memory.id,
      sourceSubsystem: "USER_DECLARED",
      observedAt: new Date(),
      evidenceType: "USER_CONFIRMATION",
      evidenceJson: toPrismaJson({ summary: "You confirmed this memory." }),
      weight: 95,
      fingerprint,
    },
  });
  const evidence = await prisma.careerMemoryEvidence.findMany({ where: { careerMemoryId: memory.id } });
  const computed = computeConfidenceScore({
    sourceType: memory.sourceType,
    evidence,
    confirmed: true,
    contradicted: false,
    now: new Date(),
  });
  const updated = await prisma.careerMemory.update({
    where: { id: memory.id },
    data: { lastConfirmedAt: new Date(), confidence: computed.band, confidenceScore: computed.score },
  });
  await audit(userId, memory.id, "CONFIRMED", "User confirmed this memory.");
  return updated;
}

export async function markCareerMemoryOutdated(userId: string, id: string) {
  const memory = await ownedActive(userId, id);
  const updated = await prisma.careerMemory.update({
    where: { id: memory.id },
    data: { status: "EXPIRED", validUntil: new Date() },
  });
  await deactivateRelationsForMemory(userId, memory.id);
  await audit(userId, memory.id, "EXPIRED", "User marked this memory outdated.");
  return updated;
}

export async function suppressCareerMemory(userId: string, id: string) {
  const memory = await ownedActive(userId, id);
  const updated = await prisma.careerMemory.update({
    where: { id: memory.id },
    data: { status: "SUPPRESSED" },
  });
  await deactivateRelationsForMemory(userId, memory.id);
  await audit(userId, memory.id, "SUPPRESSED", "User asked CareerOS not to use this claim.");
  return updated;
}

export async function restoreCareerMemory(userId: string, id: string) {
  const memory = await ownedActive(userId, id);
  if (memory.status !== "SUPPRESSED" && memory.status !== "EXPIRED") {
    throw new CareerMemoryAccessError("CONFLICT", "Only suppressed or expired memory can be restored.");
  }
  const updated = await prisma.careerMemory.update({
    where: { id: memory.id },
    data: { status: "ACTIVE", validUntil: null },
  });
  await audit(userId, memory.id, "RESTORED", "User restored this memory.");
  return updated;
}

export async function correctCareerMemory(userId: string, id: string, nextValue: string) {
  const memory = await ownedActive(userId, id);
  const cleaned = sanitizeNormalizedText(nextValue);
  if (isBlockedManualValue(cleaned)) throw new CareerMemoryAccessError("INVALID_INPUT", "That value cannot be stored.");
  const valueKey = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const semanticKey = semanticMemoryKey({
    type: memory.type,
    category: memory.category,
    subjectKey: memory.subjectKey,
    normalizedValueKey: valueKey,
  });
  const now = new Date();
  const created = await prisma.careerMemory.create({
    data: {
      userId,
      type: memory.type,
      category: memory.category,
      subjectKey: memory.subjectKey,
      normalizedValueKey: valueKey,
      valueJson: toPrismaJson({ value: cleaned }),
      normalizedText: cleaned,
      semanticKey,
      status: "ACTIVE",
      confidence: "HIGH",
      confidenceScore: 100,
      importance: memory.importance,
      firstObservedAt: now,
      lastObservedAt: now,
      lastConfirmedAt: now,
      sourceType: "USER_CORRECTED",
      isUserDeclared: false,
      isUserCorrected: true,
      supersedesMemoryId: memory.id,
      validFrom: now,
    },
  });
  await prisma.careerMemoryEvidence.create({
    data: {
      userId,
      careerMemoryId: created.id,
      sourceSubsystem: "USER_CORRECTED",
      observedAt: now,
      evidenceType: "USER_CORRECTION",
      evidenceJson: toPrismaJson({ summary: "You corrected this memory." }),
      weight: 100,
      fingerprint: evidenceFingerprint({
        sourceSubsystem: "USER_CORRECTED",
        sourceEventId: created.id,
        semantic: semanticKey,
      }),
    },
  });
  await prisma.careerMemory.update({
    where: { id: memory.id },
    data: { status: "SUPERSEDED", validUntil: now, contradictedByMemoryId: created.id },
  });
  await deactivateRelationsForMemory(userId, memory.id);
  const relationType =
    memory.subjectKey === "focus.primary"
      ? "TARGETS_ROLE"
      : memory.subjectKey === "skill.has"
        ? "HAS_SKILL"
        : memory.subjectKey === "skill.gap"
          ? "LACKS_EVIDENCE_FOR"
          : "RELATED_TO";
  await upsertGraphFromSuggestions({
    userId,
    memoryId: created.id,
    suggestions: [
      {
        entityType: memory.category === "SKILL" || memory.category === "EVIDENCE" ? "SKILL" : "ROLE",
        canonicalKey: entityCanonical(memory.category === "SKILL" ? "skill" : "role", cleaned),
        displayName: cleaned,
        relationType,
      },
    ],
    confidence: "HIGH",
    now,
  });
  await audit(userId, memory.id, "USER_CORRECTED", "Previous memory superseded by user correction.");
  return created;
}

const MANUAL_CATEGORY: Record<string, { type: CareerMemoryType; category: CareerMemoryCategory; subjectKey: string }> = {
  role: { type: "FOCUS", category: "ROLE", subjectKey: "focus.primary" },
  skill: { type: "SKILL_SIGNAL", category: "SKILL", subjectKey: "skill.has" },
  goal: { type: "GOAL", category: "GOAL", subjectKey: "goal.primary" },
  location: { type: "PREFERENCE", category: "PREFERENCE", subjectKey: "pref.location" },
  "work-style": { type: "PREFERENCE", category: "PREFERENCE", subjectKey: "pref.work-style" },
  focus: { type: "FOCUS", category: "CAREER_TARGET", subjectKey: "focus.primary" },
  constraint: { type: "CONSTRAINT", category: "CONSTRAINT", subjectKey: "constraint.custom" },
  project: { type: "EVIDENCE_SIGNAL", category: "PROJECT", subjectKey: "project.evidence" },
  preference: { type: "PREFERENCE", category: "PREFERENCE", subjectKey: "pref.custom" },
};

export async function createUserDeclaredMemory(userId: string, body: Record<string, unknown>) {
  const category = typeof body.category === "string" ? body.category : "";
  const value = typeof body.value === "string" ? body.value : "";
  const mapping = MANUAL_CATEGORY[category];
  if (!mapping) throw new CareerMemoryAccessError("INVALID_INPUT", "Choose a career-relevant memory category.");
  if (value.length < 2 || value.length > 120) throw new CareerMemoryAccessError("INVALID_INPUT", "Enter a short career fact.");
  if (isBlockedManualValue(value)) throw new CareerMemoryAccessError("INVALID_INPUT", "That value cannot be stored.");
  const cleaned = sanitizeNormalizedText(value);
  const valueKey = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const semanticKey = semanticMemoryKey({
    type: mapping.type,
    category: mapping.category,
    subjectKey: mapping.subjectKey,
    normalizedValueKey: valueKey,
  });
  const now = new Date();
  const created = await prisma.careerMemory.create({
    data: {
      userId,
      type: mapping.type,
      category: mapping.category,
      subjectKey: mapping.subjectKey,
      normalizedValueKey: valueKey,
      valueJson: toPrismaJson({ value: cleaned, context: typeof body.context === "string" ? body.context.slice(0, 160) : undefined }),
      normalizedText: cleaned,
      semanticKey,
      status: "ACTIVE",
      confidence: "HIGH",
      confidenceScore: 95,
      importance: mapping.type === "FOCUS" || mapping.type === "CONSTRAINT" || mapping.type === "GOAL" ? "HIGH" : "MEDIUM",
      firstObservedAt: now,
      lastObservedAt: now,
      sourceType: "USER_DECLARED",
      isUserDeclared: true,
      validFrom: now,
    },
  });
  await prisma.careerMemoryEvidence.create({
    data: {
      userId,
      careerMemoryId: created.id,
      sourceSubsystem: "USER_DECLARED",
      observedAt: now,
      evidenceType: "USER_STATEMENT",
      evidenceJson: toPrismaJson({ summary: "You told CareerOS this." }),
      weight: 95,
      fingerprint: evidenceFingerprint({
        sourceSubsystem: "USER_DECLARED",
        sourceEventId: created.id,
        semantic: semanticKey,
      }),
    },
  });
  return created;
}

export async function resolveBothRelevant(userId: string, leftId: string, rightId: string) {
  const left = await ownedActive(userId, leftId);
  const right = await ownedActive(userId, rightId);
  if (left.subjectKey !== right.subjectKey) {
    throw new CareerMemoryAccessError("INVALID_INPUT", "Those memories are not the same subject.");
  }
  if (left.subjectKey === "focus.primary" || left.subjectKey === "role.primary") {
    throw new CareerMemoryAccessError("CONFLICT", "This subject is exclusive. Choose one value.");
  }
  await prisma.careerMemory.updateMany({
    where: { id: { in: [left.id, right.id] }, userId },
    data: { status: "ACTIVE", contradictedByMemoryId: null, confidence: "HIGH" },
  });
  return { left: left.id, right: right.id };
}

export async function keepExclusiveMemory(userId: string, keepId: string, dropId: string) {
  const keep = await ownedActive(userId, keepId);
  const drop = await ownedActive(userId, dropId);
  const now = new Date();
  await prisma.careerMemory.update({
    where: { id: drop.id },
    data: { status: "SUPERSEDED", validUntil: now, contradictedByMemoryId: keep.id },
  });
  await prisma.careerMemory.update({
    where: { id: keep.id },
    data: { status: "ACTIVE", contradictedByMemoryId: null },
  });
  await deactivateRelationsForMemory(userId, drop.id);
  return keep;
}
