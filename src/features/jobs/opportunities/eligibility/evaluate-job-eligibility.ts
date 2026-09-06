import type { JobEligibilityStatus } from "@/generated/prisma/client";

import type { EligibilityCheck, EligibilityCheckKey, JobRequirementInput } from "../types";

function check(key: EligibilityCheckKey, status: JobEligibilityStatus, reason: string, requiresUserConfirmation = false, evidence: string | null = null): EligibilityCheck {
  return { key, status, reason, evidence, requiresUserConfirmation };
}

export function evaluateJobEligibility(input: {
  title: string;
  location: string | null;
  description: string;
  requirements: JobRequirementInput[];
  profileWorkModes: string[];
  profileLocations: string[];
}): { checks: EligibilityCheck[]; status: JobEligibilityStatus } {
  const text = `${input.title}\n${input.location ?? ""}\n${input.description}`.toLowerCase();
  const checks: EligibilityCheck[] = [];

  const locationKnown = Boolean(input.location);
  const locationAligned =
    !input.location ||
    input.profileLocations.length === 0 ||
    input.profileLocations.some((target) => input.location?.toLowerCase().includes(target.toLowerCase()));
  checks.push(
    check(
      "LOCATION",
      !locationKnown ? "REVIEW_REQUIRED" : locationAligned ? "LIKELY_ELIGIBLE" : "REVIEW_REQUIRED",
      locationKnown
        ? locationAligned
          ? "Job location is present and does not conflict with stored location targets."
          : "Job location may differ from stored location targets."
        : "Job location is unknown.",
    ),
  );

  const remote = text.includes("remote");
  const hybrid = text.includes("hybrid");
  const workModeKnown = remote || hybrid || text.includes("on-site") || text.includes("onsite");
  checks.push(
    check(
      "WORK_MODE",
      workModeKnown ? "LIKELY_ELIGIBLE" : "REVIEW_REQUIRED",
      workModeKnown ? "Work mode is stated in the job text." : "Work mode is not clearly stated.",
    ),
  );

  const seniorityKnown = /\b(junior|mid|senior|lead|principal|intern)\b/.test(text);
  checks.push(
    check(
      "SENIORITY",
      seniorityKnown ? "LIKELY_ELIGIBLE" : "REVIEW_REQUIRED",
      seniorityKnown
        ? "Seniority wording is present. CareerOS did not invent years of experience."
        : "No explicit seniority fact was confirmed.",
    ),
  );

  checks.push(
    check(
      "LANGUAGE",
      "LIKELY_ELIGIBLE",
      "No confirmed language proficiency requirement was treated as a blocker.",
    ),
  );

  const authRequired = input.requirements.some((item) => item.category === "AUTHORIZATION" && item.normalizedName.toLowerCase().includes("authorization"));
  checks.push(
    check(
      "WORK_AUTHORIZATION",
      authRequired ? "REVIEW_REQUIRED" : "REVIEW_REQUIRED",
      "CareerOS does not infer work authorization from location, school, or nationality. Confirm this fact explicitly.",
      true,
      authRequired ? "Job mentions work authorization." : "No confirmed user authorization fact is stored.",
    ),
  );

  const visaMentioned = input.requirements.some((item) => item.normalizedName.toLowerCase().includes("visa"));
  checks.push(
    check(
      "VISA_SPONSORSHIP",
      "REVIEW_REQUIRED",
      visaMentioned
        ? "Visa/sponsorship wording exists. CareerOS will not decide eligibility."
        : "No confirmed sponsorship fact is stored.",
      true,
    ),
  );

  const clearance = input.requirements.some((item) => item.category === "SECURITY_CLEARANCE");
  checks.push(
    check(
      "SECURITY_CLEARANCE",
      clearance ? "REVIEW_REQUIRED" : "ELIGIBLE",
      clearance
        ? "A clearance requirement was found. CareerOS has no confirmed clearance fact."
        : "No security clearance requirement was extracted.",
      clearance,
    ),
  );

  checks.push(
    check(
      "REQUIRED_CERTIFICATION",
      "LIKELY_ELIGIBLE",
      "No confirmed mandatory professional license mismatch is stored.",
    ),
  );

  checks.push(
    check(
      "EMPLOYMENT_RESTRICTION",
      "LIKELY_ELIGIBLE",
      "No confirmed employment-restriction mismatch is stored. Already applied and expired listings are tracked separately from eligibility.",
    ),
  );

  const statuses = checks.map((item) => item.status);
  const status: JobEligibilityStatus = statuses.includes("INELIGIBLE")
    ? "INELIGIBLE"
    : statuses.includes("LIKELY_INELIGIBLE")
      ? "LIKELY_INELIGIBLE"
      : statuses.includes("REVIEW_REQUIRED")
        ? "REVIEW_REQUIRED"
        : statuses.includes("LIKELY_ELIGIBLE")
          ? "LIKELY_ELIGIBLE"
          : "ELIGIBLE";

  return { checks, status };
}
