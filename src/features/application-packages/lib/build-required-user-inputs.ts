import type { EligibilityCheck } from "@/features/jobs/opportunities/types";

import type { RequiredUserInput } from "../types";

export function buildRequiredUserInputs(checks: EligibilityCheck[]): RequiredUserInput[] {
  const inputs: RequiredUserInput[] = [];

  const auth = checks.find((item) => item.key === "WORK_AUTHORIZATION");
  if (auth?.requiresUserConfirmation) {
    inputs.push({
      key: "WORK_AUTHORIZATION",
      label: "Work authorization",
      category: "LEGAL",
      reason: auth.reason,
      value: null,
      valueSource: "none",
      requiresConfirmation: true,
      resolved: false,
      resolvedAt: null,
    });
  }

  const visa = checks.find((item) => item.key === "VISA_SPONSORSHIP");
  if (visa?.requiresUserConfirmation) {
    inputs.push({
      key: "VISA_SPONSORSHIP",
      label: "Visa sponsorship",
      category: "LEGAL",
      reason: visa.reason,
      value: null,
      valueSource: "none",
      requiresConfirmation: true,
      resolved: false,
      resolvedAt: null,
    });
  }

  const clearance = checks.find((item) => item.key === "SECURITY_CLEARANCE");
  if (clearance?.requiresUserConfirmation) {
    inputs.push({
      key: "SECURITY_CLEARANCE",
      label: "Security clearance",
      category: "SENSITIVE",
      reason: clearance.reason,
      value: null,
      valueSource: "none",
      requiresConfirmation: true,
      resolved: false,
      resolvedAt: null,
    });
  }

  return inputs;
}

export function mergePreservedInputs(
  generated: RequiredUserInput[],
  previous: RequiredUserInput[],
): RequiredUserInput[] {
  return generated.map((item) => {
    const existing = previous.find((row) => row.key === item.key);
    if (!existing?.resolved) return item;
    return existing;
  });
}
