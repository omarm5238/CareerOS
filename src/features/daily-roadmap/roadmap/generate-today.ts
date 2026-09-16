import { prisma } from "@/server/db/prisma";
import type { DailyRoadmapActionType, Prisma } from "@/generated/prisma/client";

import { DailyRoadmapAccessError } from "../errors";
import { toPrismaJson } from "../lib/json";
import { contextFingerprint } from "../lib/fingerprint";
import { getCareerLocalDate } from "../lib/timezone";
import { getOrCreateDailyRoadmapPreference } from "../preferences/preference-service";
import { generateDailyActionCandidates } from "../candidates/generate-candidates";
import { scoreCandidates } from "../prioritization/score-candidate";
import { selectDailyPlan } from "../prioritization/select-plan";
import { assistDailyRoadmapWording } from "../wording/assist-wording";
import { rebuildCareerActivityDay } from "../activity/rebuild-day";
import type { DailyRoadmapView, ScoredDailyActionCandidate } from "../types";
import { toRoadmapView } from "../lib/roadmap-view";

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function snapshotForAction(candidate: ScoredDailyActionCandidate) {
  return {
    ...candidate.contextSnapshot,
    whyNowFacts: candidate.whyNowFacts,
    priorityComponents: candidate.priority.components,
    priorityTotal: candidate.priority.total,
    hardOverride: candidate.priority.hardOverride,
    hardOverrideReason: candidate.priority.hardOverrideReason,
    category: candidate.category,
    optionalLater: false,
  };
}

async function persistPlan(input: {
  userId: string;
  localDate: string;
  timezone: string;
  generationSource: "DETERMINISTIC" | "AI_ASSISTED" | "FALLBACK";
  fingerprint: string;
  core: ScoredDailyActionCandidate[];
  optionalLater: ScoredDailyActionCandidate[];
  plannedMinutes: number;
  whyNowByFingerprint: Record<string, string>;
  originOverrides?: Map<string, ScoredDailyActionCandidate["origin"]>;
}) {
  const rows: Prisma.dailyRoadmapActionCreateManyInput[] = [];
  const push = (candidate: ScoredDailyActionCandidate, sortOrder: number, optionalLater: boolean) => {
    rows.push({
      userId: input.userId,
      dailyRoadmapId: "pending",
      type: candidate.type,
      origin: input.originOverrides?.get(candidate.fingerprint) ?? candidate.origin,
      sourceEntityType: candidate.sourceEntityType,
      sourceEntityId: candidate.sourceEntityId,
      title: candidate.title,
      summary: candidate.summary,
      whyNow: input.whyNowByFingerprint[candidate.fingerprint] ?? candidate.whyNowFacts[0] ?? null,
      priorityScore: candidate.priority.total,
      priorityBand: candidate.priority.band,
      estimatedMinutes: candidate.estimatedMinutes,
      status: candidate.isActionable ? "PLANNED" : "BLOCKED",
      isMeaningful: candidate.isMeaningful,
      isActionable: candidate.isActionable,
      blockedReason: candidate.blockedReason,
      sortOrder,
      deepLink: candidate.deepLink,
      contextSnapshotJson: toPrismaJson({ ...snapshotForAction(candidate), optionalLater }),
      fingerprint: candidate.fingerprint,
    });
  };

  input.core.forEach((item, index) => push(item, index, false));
  input.optionalLater.forEach((item, index) => push(item, 100 + index, true));

  return prisma.$transaction(async (tx) => {
    const roadmap = await tx.dailyRoadmap.create({
      data: {
        userId: input.userId,
        localDate: input.localDate,
        timezone: input.timezone,
        status: "ACTIVE",
        plannedMinutes: input.plannedMinutes,
        contextFingerprint: input.fingerprint,
        generationSource: input.generationSource,
      },
    });

    if (rows.length > 0) {
      await tx.dailyRoadmapAction.createMany({
        data: rows.map((row) => ({ ...row, dailyRoadmapId: roadmap.id })),
      });
    }

    const created = await tx.dailyRoadmap.findUniqueOrThrow({
      where: { id: roadmap.id },
      include: { actions: { orderBy: { sortOrder: "asc" } } },
    });
    return created;
  });
}

export async function loadRoadmapForLocalDate(userId: string, localDate: string) {
  return prisma.dailyRoadmap.findUnique({
    where: { userId_localDate: { userId, localDate } },
    include: { actions: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function generateTodayRoadmap(
  userId: string,
  options?: { now?: Date },
): Promise<DailyRoadmapView> {
  const now = options?.now ?? new Date();
  const preferences = await getOrCreateDailyRoadmapPreference(userId);
  const localDate = getCareerLocalDate(now, preferences.timezone);

  const existing = await loadRoadmapForLocalDate(userId, localDate);
  if (existing) return toRoadmapView(existing);

  const previous = await prisma.dailyRoadmap.findMany({
    where: { userId, localDate: { lt: localDate } },
    orderBy: { localDate: "desc" },
    take: 3,
    include: { actions: true },
  });

  const candidates = await generateDailyActionCandidates({ userId, preferences, now });
  const scored = scoreCandidates(candidates, localDate);
  const originOverrides = new Map<string, ScoredDailyActionCandidate["origin"]>();
  for (const roadmap of previous) {
    for (const action of roadmap.actions) {
      if (
        (action.status === "PLANNED" || action.status === "IN_PROGRESS" || action.status === "DEFERRED") &&
        (action.status !== "DEFERRED" || (action.deferredUntil && action.deferredUntil <= localDate))
      ) {
        if (scored.some((item) => item.fingerprint === action.fingerprint)) {
          originOverrides.set(action.fingerprint, "CARRIED_OVER");
        }
      }
    }
  }

  const plan = selectDailyPlan(scored, {
    maxCoreActions: preferences.maxCoreActions,
    dailyMinutesTarget: preferences.dailyMinutesTarget,
  });
  const wording = await assistDailyRoadmapWording([...plan.core, ...plan.optionalLater]);
  const fingerprint = contextFingerprint({
    localDate,
    timezone: preferences.timezone,
    maxCoreActions: preferences.maxCoreActions,
    dailyMinutesTarget: preferences.dailyMinutesTarget,
    includeLinkedIn: preferences.includeLinkedIn,
    includeSkillDevelopment: preferences.includeSkillDevelopment,
    identities: [...plan.core, ...plan.optionalLater].map((item) => item.fingerprint).sort(),
  });

  try {
    const created = await persistPlan({
      userId,
      localDate,
      timezone: preferences.timezone,
      generationSource: wording.source,
      fingerprint,
      core: plan.core,
      optionalLater: plan.optionalLater,
      plannedMinutes: plan.plannedMinutes,
      whyNowByFingerprint: wording.whyNowByFingerprint,
      originOverrides,
    });
    await rebuildCareerActivityDay(userId, localDate, preferences.timezone);
    return toRoadmapView(created);
  } catch (error) {
    if (isUniqueConflict(error)) {
      const raced = await loadRoadmapForLocalDate(userId, localDate);
      if (raced) return toRoadmapView(raced);
    }
    throw error;
  }
}

export function assertOwnedAction<T extends { userId: string }>(userId: string, action: T | null): T {
  if (!action) throw new DailyRoadmapAccessError("NOT_FOUND", "Roadmap action not found.");
  if (action.userId !== userId) throw new DailyRoadmapAccessError("NOT_FOUND", "Roadmap action not found.");
  return action;
}

export async function getOwnedAction(userId: string, actionId: string) {
  const action = await prisma.dailyRoadmapAction.findUnique({ where: { id: actionId } });
  return assertOwnedAction(userId, action);
}

export type { DailyRoadmapActionType };
