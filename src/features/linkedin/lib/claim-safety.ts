import type { LinkedinCareerContext, LinkedinEvidenceItem, LinkedinWarning } from "../types";

const SENIORITY_PATTERN =
  /\b(senior|staff|principal|lead|director|head of|vp|vice president|10\+?\s+years|industry expert|award[- ]winning)\b/i;
const METRIC_PATTERN =
  /\b(\d{2,}%|increased (performance|revenue|conversion|traffic) by|grew (users|revenue)|\$\d)/i;
const CERT_PATTERN = /\b(aws certified|gcp certified|azure certified|certified (solutions|kubernetes)|pmp certified)\b/i;
const LEADERSHIP_PATTERN = /\b(led (a )?(team of )?\d+|managed \d+ engineers|led \d+ engineers)\b/i;
const EMPLOYER_PATTERN =
  /\b(worked (at|with) (google|meta|amazon|apple|microsoft|netflix)|ex-google|ex-meta)\b/i;

export function detectUnsupportedClaims(text: string, evidence: LinkedinEvidenceItem[]): LinkedinWarning[] {
  const warnings: LinkedinWarning[] = [];
  const haystack = evidence.map((item) => `${item.label} ${item.detail ?? ""}`.toLowerCase()).join(" ");

  const checks: Array<{ pattern: RegExp; code: string; message: string; evidenceHint?: RegExp }> = [
    {
      pattern: METRIC_PATTERN,
      code: "unsupported_metric",
      message: "This draft includes a quantitative result that is not grounded in CareerOS evidence.",
    },
    {
      pattern: CERT_PATTERN,
      code: "unsupported_certification",
      message: "This draft claims a certification that is not present in CareerOS evidence.",
    },
    {
      pattern: SENIORITY_PATTERN,
      code: "unsupported_seniority",
      message: "This draft uses seniority or expertise language that CareerOS evidence does not support.",
    },
    {
      pattern: LEADERSHIP_PATTERN,
      code: "unsupported_leadership",
      message: "This draft claims team leadership that is not present in CareerOS evidence.",
    },
    {
      pattern: EMPLOYER_PATTERN,
      code: "unsupported_employer",
      message: "This draft names an employer or client that is not present in CareerOS evidence.",
    },
  ];

  for (const check of checks) {
    const match = text.match(check.pattern);
    if (!match) continue;
    const claimed = match[0].toLowerCase();
    if (haystack.includes(claimed) || (check.evidenceHint && check.evidenceHint.test(haystack))) {
      continue;
    }
    const supportedEmployer = check.code === "unsupported_employer" && haystack.includes(claimed.replace(/^worked (at|with) /, ""));
    if (supportedEmployer) continue;
    warnings.push({ code: check.code, message: check.message });
  }

  return warnings;
}

export function flagUnsupportedPositioning(
  statement: string,
  context: LinkedinCareerContext,
): LinkedinWarning[] {
  return detectUnsupportedClaims(statement, context.evidence);
}

const USER_EVIDENCE_KINDS = new Set([
  "SKILL",
  "PROJECT",
  "EDUCATION",
  "CERTIFICATION",
  "WORK_HISTORY",
  "LEARNING",
]);

export function hasEvidenceForTopic(context: LinkedinCareerContext, topic: string): LinkedinEvidenceItem | null {
  const needle = topic.toLowerCase();
  return (
    context.evidence.find(
      (item) =>
        USER_EVIDENCE_KINDS.has(item.kind) &&
        (item.label.toLowerCase().includes(needle) || item.detail?.toLowerCase().includes(needle)),
    ) ?? null
  );
}
