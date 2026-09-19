import { prisma } from "@/server/db/prisma";

import { entityCanonical, displayName } from "../lib/canonical";
import { relationFingerprint } from "../lib/fingerprint";
import { asRecord, asStringArray, toPrismaJson } from "../lib/json";
import { confidenceLabel } from "../lib/views";
import type { CareerGraphView, MemoryGraphSuggestion } from "../types";

export async function ensureUserEntity(userId: string) {
  return prisma.careerGraphEntity.upsert({
    where: { userId_canonicalKey: { userId, canonicalKey: "user:self" } },
    update: { displayName: "You", status: "ACTIVE" },
    create: {
      userId,
      entityType: "USER",
      canonicalKey: "user:self",
      displayName: "You",
      status: "ACTIVE",
    },
  });
}

export async function upsertGraphFromSuggestions(input: {
  userId: string;
  memoryId: string;
  suggestions: MemoryGraphSuggestion[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  now: Date;
}) {
  const self = await ensureUserEntity(input.userId);
  for (const suggestion of input.suggestions) {
    const entity = await prisma.careerGraphEntity.upsert({
      where: { userId_canonicalKey: { userId: input.userId, canonicalKey: suggestion.canonicalKey } },
      update: { displayName: suggestion.displayName, status: "ACTIVE" },
      create: {
        userId: input.userId,
        entityType: suggestion.entityType,
        canonicalKey: suggestion.canonicalKey,
        displayName: suggestion.displayName,
        status: "ACTIVE",
      },
    });
    const fingerprint = relationFingerprint({
      relationType: suggestion.relationType,
      fromKey: "user:self",
      toKey: suggestion.canonicalKey,
    });
    const existing = await prisma.careerGraphRelation.findUnique({
      where: { userId_fingerprint: { userId: input.userId, fingerprint } },
    });
    const memoryIds = existing ? asStringArray(asRecord(existing.evidenceJson).memoryIds) : [];
    if (!memoryIds.includes(input.memoryId)) memoryIds.push(input.memoryId);
    await prisma.careerGraphRelation.upsert({
      where: { userId_fingerprint: { userId: input.userId, fingerprint } },
      update: {
        status: "ACTIVE",
        confidence: input.confidence,
        validUntil: null,
        evidenceJson: toPrismaJson({
          memoryIds,
          summary: `${suggestion.relationType.replaceAll("_", " ").toLowerCase()} ${suggestion.displayName}`,
        }),
      },
      create: {
        userId: input.userId,
        fromEntityId: self.id,
        toEntityId: entity.id,
        relationType: suggestion.relationType,
        confidence: input.confidence,
        validFrom: input.now,
        fingerprint,
        evidenceJson: toPrismaJson({
          memoryIds,
          summary: `${suggestion.relationType.replaceAll("_", " ").toLowerCase()} ${suggestion.displayName}`,
        }),
      },
    });
  }
}

export async function deactivateRelationsForMemory(userId: string, memoryId: string) {
  const relations = await prisma.careerGraphRelation.findMany({
    where: { userId, status: "ACTIVE" },
    take: 200,
  });
  for (const relation of relations) {
    const payload = asRecord(relation.evidenceJson);
    const memoryIds = asStringArray(payload.memoryIds).filter((id) => id !== memoryId);
    if (asStringArray(payload.memoryIds).includes(memoryId) && memoryIds.length === 0) {
      await prisma.careerGraphRelation.update({
        where: { id: relation.id },
        data: { status: "SUPERSEDED", validUntil: new Date(), evidenceJson: toPrismaJson({ ...payload, memoryIds }) },
      });
    } else if (asStringArray(payload.memoryIds).includes(memoryId)) {
      await prisma.careerGraphRelation.update({
        where: { id: relation.id },
        data: { evidenceJson: toPrismaJson({ ...payload, memoryIds }) },
      });
    }
  }
}

export async function getCareerGraphView(userId: string): Promise<CareerGraphView> {
  const [nodes, relations] = await Promise.all([
    prisma.careerGraphEntity.findMany({ where: { userId, status: "ACTIVE" }, take: 80 }),
    prisma.careerGraphRelation.findMany({
      where: { userId, status: "ACTIVE" },
      include: { from: true, to: true },
      take: 80,
    }),
  ]);
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      entityType: node.entityType,
      canonicalKey: node.canonicalKey,
      displayName: node.displayName,
    })),
    relations: relations.map((relation) => ({
      id: relation.id,
      relationType: relation.relationType,
      fromKey: relation.from.canonicalKey,
      toKey: relation.to.canonicalKey,
      fromName: relation.from.displayName,
      toName: relation.to.displayName,
      confidence: relation.confidence,
      confidenceLabel: confidenceLabel(relation.confidence),
      why: String(asRecord(relation.evidenceJson).summary ?? "Supported by career memory."),
      status: relation.status,
    })),
  };
}

export { entityCanonical, displayName };
