import { prisma } from "@/server/db/prisma";

import { getCareerLocalDate } from "../lib/timezone";
import { toRoadmapView } from "../lib/roadmap-view";
import { getOrCreateDailyRoadmapPreference } from "../preferences/preference-service";
import { calculateCareerStreak } from "../activity/calculate-streak";
import { generateDailyActionCandidates, firstUseSuggestionsFromCandidates } from "../candidates/generate-candidates";
import { reconcileDailyRoadmap } from "../reconciliation/reconcile";
import { rebuildCareerActivityDay } from "../activity/rebuild-day";
import type { TodayWorkspaceView } from "../types";

export async function getTodayWorkspace(
  userId: string,
  options?: { now?: Date },
): Promise<TodayWorkspaceView> {
  const now = options?.now ?? new Date();
  const preferences = await getOrCreateDailyRoadmapPreference(userId);
  const localDate = getCareerLocalDate(now, preferences.timezone);
  const streak = await calculateCareerStreak(userId, now);

  let roadmapRow = await prisma.dailyRoadmap.findUnique({
    where: { userId_localDate: { userId, localDate } },
    include: { actions: { orderBy: { sortOrder: "asc" } } },
  });

  if (roadmapRow) {
    await reconcileDailyRoadmap(userId, roadmapRow.id);
    await rebuildCareerActivityDay(userId, localDate, roadmapRow.timezone);
    roadmapRow = await prisma.dailyRoadmap.findUnique({
      where: { id: roadmapRow.id },
      include: { actions: { orderBy: { sortOrder: "asc" } } },
    });
  }

  const roadmap = roadmapRow ? toRoadmapView(roadmapRow) : null;
  const planned = roadmap
    ? roadmap.actions.filter((action) =>
        action.status === "PLANNED" || action.status === "IN_PROGRESS" || action.status === "COMPLETED" || action.status === "BLOCKED",
      )
    : [];
  const completed = roadmap?.completed ?? [];
  const candidates = !roadmap
    ? await generateDailyActionCandidates({ userId, preferences, now })
    : [];
  const firstUseSuggestions = firstUseSuggestionsFromCandidates(candidates);

  let emptyState: TodayWorkspaceView["emptyState"] = null;
  if (!roadmap && firstUseSuggestions.length > 0 && candidates.every((item) => item.category === "setup")) {
    emptyState = "first_use";
  } else if (!roadmap) {
    emptyState = "no_roadmap";
  } else if (roadmap.topPriorities.length === 0) {
    emptyState = "no_urgent";
  } else {
    emptyState = "active";
  }

  return {
    localDate,
    timezone: preferences.timezone,
    preferences,
    roadmap,
    streak,
    progress: {
      completedActions: completed.length,
      plannedActions: planned.length,
      completedEstimatedMinutes: completed.reduce((sum, action) => sum + action.estimatedMinutes, 0),
      plannedEstimatedMinutes: roadmap?.plannedMinutes ?? 0,
      meaningfulActions: completed.filter((action) => action.isMeaningful).length,
    },
    emptyState,
    firstUseSuggestions,
  };
}
