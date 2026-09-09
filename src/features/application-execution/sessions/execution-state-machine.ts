import type { ApplicationExecutionStatus } from "@/generated/prisma/client";

import { ExecutionAccessError } from "../lib/permissions";

const HAPPY: ApplicationExecutionStatus[] = [
  "CREATED",
  "DETECTING_ATS",
  "INSPECTING",
  "READY_TO_FILL",
  "FILLING",
  "READY_FOR_REVIEW",
  "READY_TO_SUBMIT",
  "SUBMITTING",
  "VERIFYING",
  "SUBMITTED",
];

const PAUSE: ApplicationExecutionStatus[] = [
  "NEEDS_USER_INPUT",
  "PAUSED_FOR_LOGIN",
  "PAUSED_FOR_MFA",
  "PAUSED_FOR_CAPTCHA",
  "PAUSED_FOR_ASSESSMENT",
];

const RECOVERY: ApplicationExecutionStatus[] = ["INSPECTING", "READY_TO_FILL", "FILLING"];

const TERMINAL: ApplicationExecutionStatus[] = ["INTERRUPTED", "FAILED", "BLOCKED", "CANCELLED", "SUBMITTED"];

export const ACTIVE_SESSION_STATUSES: ApplicationExecutionStatus[] = [
  "CREATED",
  "DETECTING_ATS",
  "INSPECTING",
  "READY_TO_FILL",
  "FILLING",
  "NEEDS_USER_INPUT",
  "PAUSED_FOR_LOGIN",
  "PAUSED_FOR_MFA",
  "PAUSED_FOR_CAPTCHA",
  "PAUSED_FOR_ASSESSMENT",
  "READY_FOR_REVIEW",
  "READY_TO_SUBMIT",
  "SUBMITTING",
  "VERIFYING",
];

export function isTerminalStatus(status: ApplicationExecutionStatus): boolean {
  return TERMINAL.includes(status);
}

export function isPauseStatus(status: ApplicationExecutionStatus): boolean {
  return PAUSE.includes(status);
}

export function canTransition(
  from: ApplicationExecutionStatus,
  to: ApplicationExecutionStatus,
): boolean {
  if (from === to) return true;
  if (from === "FAILED" && (RECOVERY.includes(to) || to === "READY_FOR_REVIEW" || to === "VERIFYING" || to === "INSPECTING")) return true;
  if (from === "CANCELLED" || from === "SUBMITTED") return false;
  if (to === "CANCELLED" || to === "INTERRUPTED" || to === "FAILED" || to === "BLOCKED") return true;

  const fromHappy = HAPPY.indexOf(from);
  const toHappy = HAPPY.indexOf(to);
  if (fromHappy >= 0 && toHappy >= 0 && toHappy >= fromHappy - 1) return true;

  if (PAUSE.includes(from) && (RECOVERY.includes(to) || PAUSE.includes(to) || to === "READY_FOR_REVIEW" || to === "DETECTING_ATS")) return true;
  if (RECOVERY.includes(from) && PAUSE.includes(to)) return true;
  if (from === "INTERRUPTED" && (RECOVERY.includes(to) || to === "DETECTING_ATS" || to === "INSPECTING")) return true;
  if (from === "VERIFYING" && to === "SUBMITTED") return true;
  if ((from === "FILLING" || from === "READY_TO_FILL" || from === "READY_FOR_REVIEW" || from === "READY_TO_SUBMIT") && (to === "DETECTING_ATS" || to === "INSPECTING" || to === "FILLING")) return true;
  if (from === "READY_TO_SUBMIT" && to === "READY_FOR_REVIEW") return true;
  if (from === "CREATED" && to === "DETECTING_ATS") return true;
  return false;
}

export function assertTransition(from: ApplicationExecutionStatus, to: ApplicationExecutionStatus): void {
  if (!canTransition(from, to)) {
    throw new ExecutionAccessError("CONFLICT", `Cannot move execution from ${from} to ${to}.`);
  }
}

export function assertNotCancelled(status: ApplicationExecutionStatus, action: string): void {
  if (status === "CANCELLED") {
    throw new ExecutionAccessError("CONFLICT", `Cannot ${action} a cancelled execution.`);
  }
}
