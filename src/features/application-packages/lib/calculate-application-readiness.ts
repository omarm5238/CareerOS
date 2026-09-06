import type { ApplicationPackageQaStatus, ApplicationReadinessStatus } from "@/generated/prisma/client";

import type { RequiredUserInput } from "../types";

export function calculateApplicationReadiness(input: {
  listingExpired: boolean;
  alreadyApplied: boolean;
  resumeReady: boolean;
  resumeExists: boolean;
  coverLetterRequired: boolean;
  coverLetterReady: boolean;
  requiredInputs: RequiredUserInput[];
  qaStatus: ApplicationPackageQaStatus;
}): ApplicationReadinessStatus {
  if (input.listingExpired || input.alreadyApplied || input.qaStatus === "BLOCKED") {
    return "BLOCKED";
  }
  if (!input.resumeExists) return "NEEDS_REVIEW";
  if (!input.resumeReady) return "NEEDS_REVIEW";
  if (input.coverLetterRequired && !input.coverLetterReady) return "NEEDS_REVIEW";
  if (input.requiredInputs.some((item) => !item.resolved)) return "NEEDS_REVIEW";
  if (input.qaStatus === "USER_INPUT_REQUIRED" || input.qaStatus === "NEEDS_REPAIR" || input.qaStatus === "FAILED") {
    return "NEEDS_REVIEW";
  }
  if (input.qaStatus !== "PASS") return "NEEDS_REVIEW";
  return "READY";
}
