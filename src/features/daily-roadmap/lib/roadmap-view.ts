import type { dailyRoadmap, dailyRoadmapAction } from "@/generated/prisma/client";

import { asContextSnapshot } from "./json";
import { toActionView } from "./views";
import type { DailyRoadmapActionView, DailyRoadmapView } from "../types";

export function toRoadmapView(
  roadmap: dailyRoadmap & { actions: dailyRoadmapAction[] },
): DailyRoadmapView {
  const actions = [...roadmap.actions]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toActionView);

  const isOptional = (action: dailyRoadmapAction) =>
    Boolean(asContextSnapshot(action.contextSnapshotJson).optionalLater);

  const planned = actions.filter(
    (action) =>
      (action.status === "PLANNED" || action.status === "IN_PROGRESS" || action.status === "BLOCKED") &&
      !roadmap.actions.find((row) => row.id === action.id && isOptional(row)),
  );
  const optionalLater = actions.filter((action) => {
    const row = roadmap.actions.find((item) => item.id === action.id);
    return row ? isOptional(row) && action.status === "PLANNED" : false;
  });
  const completed = actions.filter((action) => action.status === "COMPLETED");
  const deferred = actions.filter((action) => action.status === "DEFERRED");
  const blocked = planned.filter((action) => action.status === "BLOCKED" || Boolean(action.blockedReason));
  const corePlanned = planned.filter((action) => action.status !== "BLOCKED");
  const topPriorities = corePlanned.slice(0, 3);
  const remainingCore = corePlanned.slice(3);

  return {
    id: roadmap.id,
    localDate: roadmap.localDate,
    timezone: roadmap.timezone,
    status: roadmap.status,
    generatedAt: roadmap.generatedAt.toISOString(),
    refreshedAt: roadmap.refreshedAt?.toISOString() ?? null,
    plannedMinutes: roadmap.plannedMinutes,
    generationSource: roadmap.generationSource,
    actions,
    topPriorities,
    remainingCore,
    completed,
    deferred,
    optionalLater,
    blocked,
  };
}

export function actionViewsForQa(actions: DailyRoadmapActionView[]) {
  return actions.map((action) => ({ id: action.id, status: action.status, fingerprint: action.fingerprint }));
}
