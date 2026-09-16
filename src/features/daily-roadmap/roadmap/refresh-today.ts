import { prisma } from "@/server/db/prisma";

import { toPrismaJson } from "../lib/json";
import { contextFingerprint } from "../lib/fingerprint";
import { getCareerLocalDate } from "../lib/timezone";
import { toRoadmapView } from "../lib/roadmap-view";
import { getOrCreateDailyRoadmapPreference } from "../preferences/preference-service";
import { generateDailyActionCandidates } from "../candidates/generate-candidates";
import { scoreCandidates } from "../prioritization/score-candidate";
import { selectDailyPlan } from "../prioritization/select-plan";
import { assistDailyRoadmapWording } from "../wording/assist-wording";
import { reconcileDailyRoadmap } from "../reconciliation/reconcile";
import { rebuildCareerActivityDay } from "../activity/rebuild-day";
import { DailyRoadmapAccessError } from "../errors";
import type { DailyRoadmapView } from "../types";

export async function refreshTodayRoadmap(
  userId: string,
  options?: { now?: Date },
): Promise<DailyRoadmapView> {
  const now = options?.now ?? new Date();
  const preferences = await getOrCreateDailyRoadmapPreference(userId);
  const localDate = getCareerLocalDate(now, preferences.timezone);
  const existing = await prisma.dailyRoadmap.findUnique({
    where: { userId_localDate: { userId, localDate } },
    include: { actions: true },
  });
  if (!existing) {
    throw new DailyRoadmapAccessError("NOT_FOUND", "Generate today's roadmap before refreshing.");
  }

  await reconcileDailyRoadmap(userId, existing.id);
  const current = await prisma.dailyRoadmap.findUniqueOrThrow({
    where: { id: existing.id },
    include: { actions: { orderBy: { sortOrder: "asc" } } },
  });

  const candidates = await generateDailyActionCandidates({ userId, preferences, now });
  const scored = scoreCandidates(candidates, localDate);
  const plan = selectDailyPlan(scored, {
    maxCoreActions: preferences.maxCoreActions,
    dailyMinutesTarget: preferences.dailyMinutesTarget,
  });

  const preservedFingerprints = new Set(
    current.actions
      .filter(
        (action) =>
          action.origin === "USER_CREATED" ||
          action.status === "COMPLETED" ||
          action.status === "DEFERRED" ||
          action.status === "SKIPPED" ||
          action.status === "IN_PROGRESS",
      )
      .map((action) => action.fingerprint),
  );

  const existingByFingerprint = new Map(current.actions.map((action) => [action.fingerprint, action]));
  const incoming = [...plan.core, ...plan.optionalLater];
  const incomingFingerprints = new Set(incoming.map((item) => item.fingerprint));

  for (const action of current.actions) {
    if (action.origin === "USER_CREATED") continue;
    if (action.status === "COMPLETED" || action.status === "DEFERRED" || action.status === "SKIPPED" || action.status === "IN_PROGRESS") {
      continue;
    }
    if (action.status === "PLANNED" && !incomingFingerprints.has(action.fingerprint)) {
      await prisma.dailyRoadmapAction.update({
        where: { id: action.id },
        data: { status: "EXPIRED" },
      });
    }
  }

  const wording = await assistDailyRoadmapWording(incoming.filter((item) => !preservedFingerprints.has(item.fingerprint)));
  let sortOrder = 0;
  for (const candidate of incoming) {
    const existingAction = existingByFingerprint.get(candidate.fingerprint);
    if (existingAction) {
      if (
        existingAction.origin === "USER_CREATED" ||
        existingAction.status === "COMPLETED" ||
        existingAction.status === "DEFERRED" ||
        existingAction.status === "SKIPPED" ||
        existingAction.status === "IN_PROGRESS"
      ) {
        if (existingAction.status === "PLANNED" || existingAction.status === "IN_PROGRESS") {
          await prisma.dailyRoadmapAction.update({
            where: { id: existingAction.id },
            data: { sortOrder, priorityScore: candidate.priority.total, priorityBand: candidate.priority.band },
          });
        }
        sortOrder += 1;
        continue;
      }
      await prisma.dailyRoadmapAction.update({
        where: { id: existingAction.id },
        data: {
          title: candidate.title,
          summary: candidate.summary,
          whyNow: wording.whyNowByFingerprint[candidate.fingerprint] ?? candidate.whyNowFacts[0] ?? existingAction.whyNow,
          priorityScore: candidate.priority.total,
          priorityBand: candidate.priority.band,
          estimatedMinutes: candidate.estimatedMinutes,
          isActionable: candidate.isActionable,
          blockedReason: candidate.blockedReason,
          status: candidate.isActionable ? (existingAction.status === "EXPIRED" ? "PLANNED" : existingAction.status) : "BLOCKED",
          sortOrder,
          deepLink: candidate.deepLink,
          contextSnapshotJson: toPrismaJson({
            ...candidate.contextSnapshot,
            whyNowFacts: candidate.whyNowFacts,
            priorityComponents: candidate.priority.components,
            optionalLater: plan.optionalLater.some((item) => item.fingerprint === candidate.fingerprint),
          }),
        },
      });
      sortOrder += 1;
      continue;
    }

    await prisma.dailyRoadmapAction.create({
      data: {
        userId,
        dailyRoadmapId: current.id,
        type: candidate.type,
        origin: candidate.origin,
        sourceEntityType: candidate.sourceEntityType,
        sourceEntityId: candidate.sourceEntityId,
        title: candidate.title,
        summary: candidate.summary,
        whyNow: wording.whyNowByFingerprint[candidate.fingerprint] ?? candidate.whyNowFacts[0] ?? null,
        priorityScore: candidate.priority.total,
        priorityBand: candidate.priority.band,
        estimatedMinutes: candidate.estimatedMinutes,
        status: candidate.isActionable ? "PLANNED" : "BLOCKED",
        isMeaningful: candidate.isMeaningful,
        isActionable: candidate.isActionable,
        blockedReason: candidate.blockedReason,
        sortOrder,
        deepLink: candidate.deepLink,
        fingerprint: candidate.fingerprint,
        contextSnapshotJson: toPrismaJson({
          ...candidate.contextSnapshot,
          whyNowFacts: candidate.whyNowFacts,
          priorityComponents: candidate.priority.components,
          optionalLater: plan.optionalLater.some((item) => item.fingerprint === candidate.fingerprint),
        }),
      },
    });
    sortOrder += 1;
  }

  const fingerprint = contextFingerprint({
    localDate,
    identities: incoming.map((item) => item.fingerprint).sort(),
    maxCoreActions: preferences.maxCoreActions,
  });

  const updated = await prisma.dailyRoadmap.update({
    where: { id: current.id },
    data: {
      refreshedAt: now,
      contextFingerprint: fingerprint,
      plannedMinutes: plan.plannedMinutes,
      generationSource: wording.source,
    },
    include: { actions: { orderBy: { sortOrder: "asc" } } },
  });

  await rebuildCareerActivityDay(userId, localDate, preferences.timezone);
  return toRoadmapView(updated);
}
