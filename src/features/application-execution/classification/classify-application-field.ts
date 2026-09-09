export function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const LEGAL_PATTERNS = [
  /authoriz/i,
  /eligible to work/i,
  /legally (allowed|permitted|authorized)/i,
  /work permit/i,
  /visa/i,
  /sponsor/i,
  /security clearance/i,
  /citizenship/i,
  /right to work/i,
  /work authorization/i,
  /export control/i,
  /it[ao]r/i,
];

const SENSITIVE_PATTERNS = [
  /gender/i,
  /race/i,
  /ethnicity/i,
  /hispanic/i,
  /veteran/i,
  /disability/i,
  /sexual orientation/i,
  /pronoun/i,
  /lgbt/i,
  /religion/i,
  /pregnant/i,
  /eeo/i,
  /equal opportunity/i,
  /protected/i,
  /demographic/i,
];

const CONSENT_PATTERNS = [
  /i agree/i,
  /privacy/i,
  /terms (and|&) conditions/i,
  /consent/i,
  /data processing/i,
  /gdpr/i,
  /acknowledge/i,
];

const IDENTITY_PATTERNS = [
  /^(first name|given name|forename)$/i,
  /^(last name|family name|surname)$/i,
  /^(full name|name)$/i,
  /^middle name$/i,
  /^preferred name$/i,
];

const CONTACT_PATTERNS = [
  /email/i,
  /phone/i,
  /mobile/i,
  /linkedin/i,
  /github/i,
  /portfolio/i,
  /website/i,
  /url/i,
];

const DOCUMENT_PATTERNS = [/resume|cv|curriculum/i, /cover letter/i];
const FREE_TEXT_PATTERNS = [
  /why (do you want|are you interested|this company|this role)/i,
  /tell us/i,
  /describe/i,
  /cover letter text/i,
  /motivation/i,
  /good fit/i,
  /relevant experience/i,
];
const PREFERENCE_PATTERNS = [/salary/i, /compensation/i, /start date/i, /reloc/i, /notice period/i, /travel/i];
const ASSESSMENT_PATTERNS = [/assessment/i, /coding challenge/i, /personality test/i, /timed exam/i];
const REFERENCE_PATTERNS = [/reference/i, /referr/i];
const CAREER_PATTERNS = [/education/i, /school/i, /degree/i, /employer/i, /company/i, /title/i, /years of/i, /experience/i, /skill/i];

export function classifyApplicationField(input: {
  label: string;
  type: string;
  name?: string;
}): { classification: import("../types").ApplicationFieldClassification; confidence: number } {
  const text = `${input.label} ${input.name ?? ""}`.trim();
  const normalized = normalizeLabel(text);

  if (LEGAL_PATTERNS.some((re) => re.test(text) || re.test(normalized))) {
    return { classification: "LEGAL", confidence: 0.98 };
  }
  if (SENSITIVE_PATTERNS.some((re) => re.test(text))) {
    return { classification: "SENSITIVE", confidence: 0.98 };
  }
  if (CONSENT_PATTERNS.some((re) => re.test(text)) && (input.type === "CHECKBOX" || /agree|consent|privacy|terms/i.test(text))) {
    return { classification: "CONSENT", confidence: 0.96 };
  }
  if (ASSESSMENT_PATTERNS.some((re) => re.test(text))) {
    return { classification: "ASSESSMENT", confidence: 0.95 };
  }
  if (DOCUMENT_PATTERNS.some((re) => re.test(text)) && (input.type === "FILE" || /resume|cv|cover/i.test(text))) {
    return { classification: "DOCUMENT", confidence: 0.97 };
  }
  if (IDENTITY_PATTERNS.some((re) => re.test(normalized) || re.test(input.label.trim()))) {
    return { classification: "IDENTITY", confidence: 0.97 };
  }
  if (CONTACT_PATTERNS.some((re) => re.test(text))) {
    return { classification: "CONTACT", confidence: 0.96 };
  }
  if (FREE_TEXT_PATTERNS.some((re) => re.test(text)) || input.type === "TEXTAREA") {
    return { classification: "FREE_TEXT", confidence: input.type === "TEXTAREA" ? 0.86 : 0.93 };
  }
  if (REFERENCE_PATTERNS.some((re) => re.test(text))) {
    return { classification: "REFERENCE", confidence: 0.9 };
  }
  if (PREFERENCE_PATTERNS.some((re) => re.test(text))) {
    return { classification: "PREFERENCE", confidence: 0.9 };
  }
  if (CAREER_PATTERNS.some((re) => re.test(text))) {
    return { classification: "CAREER_FACT", confidence: 0.84 };
  }
  if (normalized.includes("other") && normalized.length < 24) {
    return { classification: "UNKNOWN", confidence: 0.4 };
  }
  return { classification: "UNKNOWN", confidence: 0.35 };
}

export function detectDocumentKind(label: string): "resume" | "cover_letter" | null {
  if (/cover letter/i.test(label)) return "cover_letter";
  if (/resume|cv|curriculum/i.test(label)) return "resume";
  return null;
}
