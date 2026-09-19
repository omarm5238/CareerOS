import { prisma } from "@/server/db/prisma";

import { collectMemoryCandidates } from "../candidates/from-domain";
import { computeConfidenceScore } from "../confidence/score";
import { retentionDaysFor } from "../aging/retention";
import { isHardContradiction } from "../contradictions/exclusive";
import { upsertGraphFromSuggestions } from "../graph/sync";
import { semanticMemoryKey } from "../lib/fingerprint";
import { toPrismaJson } from "../lib/json";
import { getOrCreateCareerMemoryPreference, toPreferenceView } from "../preferences/get-or-create";
import { MEMORY_BOOTSTRAP_WEEKS } from "../types";
import type { MemoryCandidate, MemoryIngestionMode } from "../types";

function sinceDate(now: Date, resetAt: Date | null, rebuild: boolean): Date {
  const bound = new Date(now.getTime() - MEMORY_BOOTSTRAP_WEEKS * 7 * 86_400_000);
  if (rebuild || !resetAt) return bound;
  return resetAt > bound ? resetAt : bound;
}

async function writeEvent(input: {
  userId: string;
  careerMemoryId?: string | null;
  eventType: "CREATED" | "UPDATED" | "CONFIDENCE_CHANGED" | "CONTRADICTED" | "SUPERSEDED" | "EXPIRED" | "REBUILT";
  reason: string;
  source: string;
}) {
  await prisma.careerMemoryEvent.create({
    data: {
      userId: input.userId,
      careerMemoryId: input.careerMemoryId ?? null,
      eventType: input.eventType,
      reason: input.reason,
      source: input.source,
    },
  });
}

async function persistCandidate(userId: string, candidate: MemoryCandidate, now: Date) {
  const semanticKey = semanticMemoryKey({
    type: candidate.type,
    category: candidate.category,
    subjectKey: candidate.subjectKey,
    normalizedValueKey: candidate.normalizedValueKey,
  });
  const suppressed = await prisma.careerMemory.findFirst({
    where: { userId, semanticKey, status: "SUPPRESSED" },
    select: { id: true },
  });
  if (suppressed) return null;

  const existing = await prisma.careerMemory.findFirst({
    where: { userId, semanticKey, status: { in: ["ACTIVE", "CONTRADICTED"] } },
    include: { evidence: true },
  });

  const memory =
    existing ??
    (await prisma.careerMemory.create({
      data: {
        userId,
        type: candidate.type,
        category: candidate.category,
        subjectKey: candidate.subjectKey,
        normalizedValueKey: candidate.normalizedValueKey,
        valueJson: toPrismaJson(candidate.value),
        normalizedText: candidate.normalizedText,
        semanticKey,
        status: "ACTIVE",
        confidence: "LOW",
        confidenceScore: 40,
        importance: candidate.importance,
        firstObservedAt: candidate.evidence[0]?.observedAt ?? now,
        lastObservedAt: now,
        sourceType: candidate.sourceType,
        isUserDeclared: candidate.sourceType === "USER_DECLARED",
        isUserCorrected: candidate.sourceType === "USER_CORRECTED",
        validFrom: now,
      },
      include: { evidence: true },
    }));

  if (!existing) {
    await writeEvent({
      userId,
      careerMemoryId: memory.id,
      eventType: "CREATED",
      reason: "Grounded memory candidate accepted.",
      source: candidate.sourceType,
    });
  }

  let added = 0;
  for (const item of candidate.evidence) {
    try {
      await prisma.careerMemoryEvidence.create({
        data: {
          userId,
          careerMemoryId: memory.id,
          sourceSubsystem: item.sourceSubsystem,
          sourceEntityType: item.sourceEntityType,
          sourceEntityId: item.sourceEntityId,
          sourceEventId: item.sourceEventId,
          observedAt: item.observedAt,
          evidenceType: item.evidenceType,
          evidenceJson: toPrismaJson(item.evidence),
          weight: item.weight,
          fingerprint: item.fingerprint,
        },
      });
      added += 1;
    } catch {
      // unique fingerprint: same evidence already counted
    }
  }

  const evidence = await prisma.careerMemoryEvidence.findMany({ where: { careerMemoryId: memory.id } });
  const computed = computeConfidenceScore({
    sourceType: candidate.sourceType,
    evidence,
    confirmed: Boolean(memory.lastConfirmedAt),
    contradicted: memory.status === "CONTRADICTED",
    now,
  });
  const latest = evidence.reduce((max, item) => (item.observedAt > max ? item.observedAt : max), memory.lastObservedAt);
  await prisma.careerMemory.update({
    where: { id: memory.id },
    data: {
      confidence: computed.band,
      confidenceScore: computed.score,
      lastObservedAt: latest,
      sourceType: memory.isUserCorrected ? "USER_CORRECTED" : memory.isUserDeclared ? "USER_DECLARED" : candidate.sourceType,
      importance: candidate.importance,
      valueJson: toPrismaJson(candidate.value),
      normalizedText: candidate.normalizedText,
    },
  });
  if (existing && added === 0 && existing.confidenceScore === computed.score) {
    // refresh with no new evidence: confidence unchanged
  } else if (existing && existing.confidence !== computed.band) {
    await writeEvent({
      userId,
      careerMemoryId: memory.id,
      eventType: "CONFIDENCE_CHANGED",
      reason: "Confidence recomputed from unique evidence.",
      source: "SYSTEM_DERIVED",
    });
  }
  await upsertGraphFromSuggestions({
    userId,
    memoryId: memory.id,
    suggestions: candidate.graphSuggestions,
    confidence: computed.band,
    now,
  });
  return memory.id;
}

async function applyAging(userId: string, now: Date) {
  const active = await prisma.careerMemory.findMany({
    where: { userId, status: "ACTIVE" },
  });
  for (const memory of active) {
    const days = retentionDaysFor(memory.type, memory.sourceType);
    if (days === null) continue;
    const age = (now.getTime() - memory.lastObservedAt.getTime()) / 86_400_000;
    if (age <= days) continue;
    await prisma.careerMemory.update({
      where: { id: memory.id },
      data: { status: "EXPIRED", validUntil: now },
    });
    await writeEvent({
      userId,
      careerMemoryId: memory.id,
      eventType: "EXPIRED",
      reason: "Derived memory aged past retention without reinforcement.",
      source: "SYSTEM_DERIVED",
    });
  }
}

async function applyContradictions(userId: string, now: Date) {
  const active = await prisma.careerMemory.findMany({
    where: { userId, status: "ACTIVE" },
  });
  const bySubject = new Map<string, typeof active>();
  for (const memory of active) {
    const list = bySubject.get(memory.subjectKey) ?? [];
    list.push(memory);
    bySubject.set(memory.subjectKey, list);
  }
  for (const [subject, list] of bySubject) {
    const uniqueValues = [...new Set(list.map((item) => item.normalizedValueKey ?? item.normalizedText))];
    if (uniqueValues.length < 2) continue;
    if (!isHardContradiction(subject, uniqueValues[0] ?? "", uniqueValues[1] ?? "")) continue;
    const ranked = [...list].sort((a, b) => {
      const rank = (item: (typeof list)[number]) =>
        item.sourceType === "USER_CORRECTED" ? 5 : item.sourceType === "USER_DECLARED" ? 4 : item.sourceType === "M23_JOBS" ? 3 : 1;
      if (rank(b) !== rank(a)) return rank(b) - rank(a);
      return b.lastObservedAt.getTime() - a.lastObservedAt.getTime();
    });
    const winner = ranked[0];
    const loser = ranked[1];
    if (!winner || !loser) continue;
    if (winner.sourceType === "USER_CORRECTED" || winner.sourceType === "USER_DECLARED") {
      await prisma.careerMemory.update({
        where: { id: loser.id },
        data: { status: "SUPERSEDED", validUntil: now, contradictedByMemoryId: winner.id },
      });
      await writeEvent({
        userId,
        careerMemoryId: loser.id,
        eventType: "SUPERSEDED",
        reason: "Newer explicit statement replaced the previous exclusive value.",
        source: winner.sourceType,
      });
      continue;
    }
    await prisma.careerMemory.update({
      where: { id: winner.id },
      data: { status: "CONTRADICTED", confidence: "LOW", contradictedByMemoryId: loser.id },
    });
    await prisma.careerMemory.update({
      where: { id: loser.id },
      data: { status: "CONTRADICTED", confidence: "LOW", contradictedByMemoryId: winner.id },
    });
    await writeEvent({
      userId,
      careerMemoryId: winner.id,
      eventType: "CONTRADICTED",
      reason: "Unresolved exclusive values need review.",
      source: "SYSTEM_DERIVED",
    });
  }
}

export async function refreshCareerMemory(
  userId: string,
  options?: { mode?: MemoryIngestionMode; now?: Date },
) {
  const now = options?.now ?? new Date();
  const mode = options?.mode ?? "ON_DEMAND";
  const preferenceRow = await getOrCreateCareerMemoryPreference(userId);
  const preferences = toPreferenceView(preferenceRow);
  if (!preferences.memoryEnabled && mode !== "REBUILD") {
    return { created: 0, skippedDisabled: true };
  }
  const since = sinceDate(now, preferenceRow.memoryResetAt, mode === "REBUILD");
  const candidates = (await collectMemoryCandidates({ userId, since, now, preferences }))
    .map((candidate) => ({
      ...candidate,
      evidence: candidate.evidence.filter((item) => item.observedAt.getTime() >= since.getTime()),
    }))
    .filter((candidate) => candidate.evidence.length > 0);
  let created = 0;
  for (const candidate of candidates) {
    const id = await persistCandidate(userId, candidate, now);
    if (id) created += 1;
  }
  await applyAging(userId, now);
  await applyContradictions(userId, now);
  await prisma.careerMemoryPreference.update({
    where: { id: preferenceRow.id },
    data: { lastRefreshedAt: now },
  });
  if (mode === "REBUILD") {
    await writeEvent({ userId, eventType: "REBUILT", reason: "Explicit rebuild from bounded history.", source: "USER_DECLARED" });
  }
  return { created, skippedDisabled: false };
}

let forceIngestFailureForTests = false;

/** Test-only seam. Forces ingestCareerMemorySafe to fail without touching domain transactions. */
export function setCareerMemoryIngestFailureForTests(enabled: boolean) {
  forceIngestFailureForTests = enabled;
}

export async function ingestCareerMemorySafe(userId: string, mode: MemoryIngestionMode) {
  try {
    if (forceIngestFailureForTests) {
      throw new Error("Forced career memory ingest failure.");
    }
    await refreshCareerMemory(userId, { mode });
  } catch {
    // Memory must never block domain events.
  }
}
