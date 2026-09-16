import type { ScoredDailyActionCandidate } from "../types";
import { MAX_OPTIONAL_LATER, TOP_PRIORITY_COUNT } from "../types";

export type SelectedDailyPlan = {
  core: ScoredDailyActionCandidate[];
  optionalLater: ScoredDailyActionCandidate[];
  top3: ScoredDailyActionCandidate[];
  plannedMinutes: number;
  overCapacity: boolean;
};

const CATEGORY_ORDER = ["applications", "follow_up", "jobs", "linkedin", "skills", "profile", "setup"] as const;

export function selectDailyPlan(
  scored: ScoredDailyActionCandidate[],
  options: { maxCoreActions: number; dailyMinutesTarget: number },
): SelectedDailyPlan {
  const actionable = scored.filter((item) => item.isActionable || item.type === "LINKEDIN_RECONNECT");
  const blockedResolution = actionable.filter((item) => item.type === "LINKEDIN_RECONNECT");
  const blocked = actionable.filter((item) => item.blockedReason && item.type !== "LINKEDIN_RECONNECT");
  const ready = actionable.filter((item) => !item.blockedReason || item.type === "LINKEDIN_RECONNECT");

  const critical = ready.filter((item) => item.priority.hardOverride || item.priority.band === "CRITICAL");
  const rest = ready.filter((item) => !critical.includes(item));

  const selected: ScoredDailyActionCandidate[] = [];
  let minutes = 0;
  let overCapacity = false;

  const take = (item: ScoredDailyActionCandidate) => {
    if (selected.some((row) => row.fingerprint === item.fingerprint)) return;
    if (selected.length >= options.maxCoreActions && !(item.priority.hardOverride || item.priority.band === "CRITICAL")) {
      return;
    }
    if (
      selected.length >= options.maxCoreActions &&
      (item.priority.hardOverride || item.priority.band === "CRITICAL")
    ) {
      selected.push(item);
      minutes += item.estimatedMinutes;
      overCapacity = true;
      return;
    }
    const nextMinutes = minutes + item.estimatedMinutes;
    if (
      nextMinutes > options.dailyMinutesTarget &&
      selected.length >= Math.min(3, options.maxCoreActions) &&
      !(item.priority.hardOverride || item.priority.band === "CRITICAL")
    ) {
      return;
    }
    if (nextMinutes > options.dailyMinutesTarget && (item.priority.hardOverride || item.priority.band === "CRITICAL")) {
      overCapacity = true;
    }
    selected.push(item);
    minutes += item.estimatedMinutes;
  };

  for (const item of critical) take(item);

  const urgencyDominates = critical.length > 0;
  if (!urgencyDominates) {
    const seenCategories = new Set(selected.map((item) => item.category));
    for (const category of CATEGORY_ORDER) {
      if (selected.length >= options.maxCoreActions) break;
      const next = rest.find((item) => item.category === category && !seenCategories.has(category));
      if (next) {
        take(next);
        seenCategories.add(category);
      }
    }
  }

  for (const item of rest) {
    if (selected.length >= options.maxCoreActions && !item.priority.hardOverride) break;
    take(item);
  }

  for (const item of blockedResolution) take(item);

  const core = selected.slice(0, Math.max(options.maxCoreActions, critical.length));
  const coreFingerprints = new Set(core.map((item) => item.fingerprint));
  const optionalLater = scored
    .filter((item) => !coreFingerprints.has(item.fingerprint) && item.isActionable && !blocked.includes(item))
    .slice(0, MAX_OPTIONAL_LATER);

  const top3 = core
    .filter((item) => item.isActionable && (!item.blockedReason || item.type === "LINKEDIN_RECONNECT"))
    .slice(0, TOP_PRIORITY_COUNT);

  return {
    core,
    optionalLater,
    top3,
    plannedMinutes: core.reduce((sum, item) => sum + item.estimatedMinutes, 0),
    overCapacity,
  };
}
