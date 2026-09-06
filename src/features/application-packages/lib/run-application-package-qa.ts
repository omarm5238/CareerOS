import type { ApplicationPackageQaStatus } from "@/generated/prisma/client";

import type { ApplicationPackageQaResult, QaCheck, RequiredUserInput } from "../types";

export function runApplicationPackageQa(input: {
  jobTitle: string;
  company: string;
  jobPostingId: string | null;
  resumeVersionId: string | null;
  resumeVersionRevisionId: string | null;
  resumeBelongsToJob: boolean;
  resumeReady: boolean;
  coverLetterRequired: boolean;
  coverLetterReady: boolean;
  coverLetterJobId: string | null;
  coverLetterHasUnsupportedClaim: boolean;
  requiredInputs: RequiredUserInput[];
  alreadyApplied: boolean;
  listingExpired: boolean;
  stale: boolean;
}): ApplicationPackageQaResult {
  const checks: QaCheck[] = [
    { key: "job", passed: Boolean(input.jobTitle), message: input.jobTitle ? "Correct role is present." : "Job title is missing." },
    { key: "company", passed: Boolean(input.company), message: input.company ? "Correct company is present." : "Company is missing." },
    { key: "jobPosting", passed: Boolean(input.jobPostingId), message: input.jobPostingId ? "Job posting is linked." : "Job posting is missing." },
    {
      key: "resume",
      passed: Boolean(input.resumeVersionId && input.resumeVersionRevisionId),
      message: input.resumeVersionRevisionId ? "Exact resume revision is linked." : "Exact resume revision is missing.",
    },
    {
      key: "resumeJob",
      passed: input.resumeBelongsToJob,
      message: input.resumeBelongsToJob ? "Resume belongs to this job context." : "Resume is not linked to this job.",
    },
    {
      key: "resumeReady",
      passed: input.resumeReady,
      message: input.resumeReady ? "Resume is user-approved Ready." : "Resume still needs your approval.",
    },
    {
      key: "coverLetter",
      passed: !input.coverLetterRequired || input.coverLetterReady,
      message: input.coverLetterRequired
        ? input.coverLetterReady
          ? "Required cover letter is Ready."
          : "Required cover letter still needs review."
        : "Cover letter is not required.",
    },
    {
      key: "coverLetterJob",
      passed: !input.coverLetterRequired || input.coverLetterJobId === input.jobPostingId,
      message: "Cover letter belongs to the correct job.",
    },
    {
      key: "unsupportedClaim",
      passed: !input.coverLetterHasUnsupportedClaim,
      message: input.coverLetterHasUnsupportedClaim
        ? "Cover letter contains an unsupported claim that can be repaired."
        : "No unsupported generated claim detected.",
    },
    {
      key: "inputs",
      passed: input.requiredInputs.every((item) => item.resolved),
      message: input.requiredInputs.every((item) => item.resolved)
        ? "Required user inputs are resolved."
        : "Required user inputs need confirmation.",
    },
    {
      key: "duplicate",
      passed: !input.alreadyApplied,
      message: input.alreadyApplied ? "Already applied to this exact listing." : "No duplicate submitted application.",
    },
    {
      key: "expired",
      passed: !input.listingExpired,
      message: input.listingExpired ? "Listing is known expired." : "Listing is not known expired.",
    },
    {
      key: "stale",
      passed: !input.stale,
      message: input.stale ? "Package context has changed." : "Package context is current.",
    },
  ];

  let status: ApplicationPackageQaStatus = "PASS";
  if (input.alreadyApplied || input.listingExpired) status = "BLOCKED";
  else if (input.coverLetterHasUnsupportedClaim) status = "NEEDS_REPAIR";
  else if (input.requiredInputs.some((item) => !item.resolved)) status = "USER_INPUT_REQUIRED";
  else if (!checks.every((item) => item.passed)) status = "FAILED";

  return { status, checks, repairAttempted: 0 };
}
