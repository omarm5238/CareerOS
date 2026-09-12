import type { ApplicationFormField, ResolvedApplicationAnswer } from "../types";

function isTruthyToken(value: string): boolean {
  return /^(true|on|yes|1)$/i.test(value.trim());
}

export function liveMatchesPlanned(planned: unknown, live: string, type: ApplicationFormField["type"]): boolean {
  const plannedText = planned === true ? "true" : planned === false ? "false" : String(planned ?? "");
  if (plannedText === live) return true;
  if (type === "CHECKBOX") {
    const plannedOn = planned === true || isTruthyToken(plannedText);
    const liveOn = live !== "" && live !== "false" && !/^off$/i.test(live);
    return plannedOn === liveOn;
  }
  return false;
}

export function applyLiveValue(existing: ResolvedApplicationAnswer | null, field: ApplicationFormField): ResolvedApplicationAnswer | null {
  if (!existing) return null;
  const live = field.currentValuePreview;
  if (live == null) return existing;
  if (liveMatchesPlanned(existing.value, live, field.type)) return existing;
  if (live === "" && field.type !== "CHECKBOX" && field.type !== "RADIO") return existing;
  if (field.classification === "LEGAL" || field.classification === "CONSENT") {
    return { ...existing, value: live || existing.value, confirmed: false, status: "NEEDS_INPUT", requiresConfirmation: true };
  }
  if (field.classification === "SENSITIVE") {
    return { ...existing, value: live || existing.value, confirmed: false, requiresConfirmation: true, savePreference: false };
  }
  if (field.classification === "FREE_TEXT") {
    return { ...existing, value: live, reviewed: false, status: "REVIEW_REQUIRED" };
  }
  return { ...existing, value: live };
}
