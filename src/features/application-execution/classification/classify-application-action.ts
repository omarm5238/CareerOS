export type ApplicationActionKind =
  | "OPEN_APPLICATION"
  | "NEXT_STEP"
  | "SAVE_AND_CONTINUE"
  | "FINAL_SUBMIT"
  | "CANCEL"
  | "UNKNOWN";

export type ApplicationActionAssessment = {
  action: ApplicationActionKind;
  confidence: number;
  trusted: boolean;
  reasons: string[];
  selector: { strategy: "css"; value: string };
  label: string;
};

export type RawPageAction = {
  selector: string;
  label: string;
  type: string;
  insideForm: boolean;
  formHasFields: boolean;
  isSubmitType: boolean;
  dataOpen: boolean;
  dataNext: boolean;
  dataFinal: boolean;
  dataCancel: boolean;
};

const OPEN_RE = /^(apply( now| for this job)?|i['’]?m interested)$/i;
const NEXT_RE = /^(next|continue)$/i;
const SAVE_CONTINUE_RE = /^(save and continue|save & continue)$/i;
const FINAL_RE = /^(submit( application| your application)?)$/i;
const CANCEL_RE = /^(cancel|close)$/i;
const REVIEW_RE = /^review$/i;

export function classifyApplicationAction(raw: RawPageAction, siblings: RawPageAction[]): ApplicationActionAssessment {
  const label = raw.label.trim();
  const reasons: string[] = [];
  let action: ApplicationActionKind = "UNKNOWN";
  let confidence = 0.4;

  if (raw.dataFinal) {
    action = "FINAL_SUBMIT";
    confidence = 0.99;
    reasons.push("data-careeros-final-submit");
  } else if (raw.dataOpen) {
    action = "OPEN_APPLICATION";
    confidence = 0.99;
    reasons.push("data-careeros-open");
  } else if (raw.dataNext) {
    action = SAVE_CONTINUE_RE.test(label) ? "SAVE_AND_CONTINUE" : "NEXT_STEP";
    confidence = 0.98;
    reasons.push("data-careeros-next");
  } else if (raw.dataCancel || CANCEL_RE.test(label)) {
    action = "CANCEL";
    confidence = raw.dataCancel ? 0.98 : 0.9;
    reasons.push(raw.dataCancel ? "data-careeros-cancel" : "cancel-text");
  } else if (OPEN_RE.test(label) && !raw.isSubmitType && !FINAL_RE.test(label)) {
    action = "OPEN_APPLICATION";
    confidence = raw.insideForm && raw.formHasFields ? 0.55 : 0.92;
    reasons.push("open-cta-text");
    if (raw.insideForm && raw.formHasFields) reasons.push("open-text-inside-populated-form");
  } else if (SAVE_CONTINUE_RE.test(label)) {
    action = "SAVE_AND_CONTINUE";
    confidence = 0.93;
    reasons.push("save-continue-text");
  } else if (NEXT_RE.test(label)) {
    action = "NEXT_STEP";
    confidence = 0.93;
    reasons.push("next-text");
  } else if (FINAL_RE.test(label) || (raw.isSubmitType && raw.insideForm && raw.formHasFields)) {
    action = "FINAL_SUBMIT";
    confidence = raw.dataFinal || (raw.isSubmitType && raw.insideForm && FINAL_RE.test(label)) ? 0.96 : 0.72;
    reasons.push(raw.isSubmitType ? "submit-type-in-form" : "submit-text");
    if (!raw.insideForm) {
      confidence = Math.min(confidence, 0.6);
      reasons.push("submit-text-outside-form");
    }
    if (!raw.formHasFields && raw.insideForm) {
      confidence = Math.min(confidence, 0.55);
      reasons.push("form-has-no-fields");
    }
  } else if (REVIEW_RE.test(label)) {
    action = "UNKNOWN";
    confidence = 0.45;
    reasons.push("review-is-ambiguous");
  } else {
    reasons.push("unrecognized-action");
  }

  const sameKind = siblings.filter((item) => classifyKindOnly(item) === action && action !== "UNKNOWN");
  if (action === "FINAL_SUBMIT" && sameKind.length > 1 && !raw.dataFinal) {
    confidence = Math.min(confidence, 0.55);
    reasons.push("multiple-submit-like-controls");
  }
  if (action === "OPEN_APPLICATION" && siblings.some((item) => classifyKindOnly(item) === "FINAL_SUBMIT") && raw.insideForm && raw.formHasFields) {
    confidence = Math.min(confidence, 0.5);
    reasons.push("open-cta-conflicts-with-final-submit");
  }

  const trusted = action !== "UNKNOWN" && confidence >= 0.85;
  if (!trusted) reasons.push("not-trusted");
  return {
    action,
    confidence,
    trusted,
    reasons,
    selector: { strategy: "css", value: raw.selector },
    label,
  };
}

function classifyKindOnly(raw: RawPageAction): ApplicationActionKind {
  const label = raw.label.trim();
  if (raw.dataFinal || FINAL_RE.test(label) || (raw.isSubmitType && raw.insideForm && raw.formHasFields)) return "FINAL_SUBMIT";
  if (raw.dataOpen || (OPEN_RE.test(label) && !raw.isSubmitType)) return "OPEN_APPLICATION";
  if (raw.dataNext && SAVE_CONTINUE_RE.test(label)) return "SAVE_AND_CONTINUE";
  if (raw.dataNext || NEXT_RE.test(label) || SAVE_CONTINUE_RE.test(label)) return "NEXT_STEP";
  if (raw.dataCancel || CANCEL_RE.test(label)) return "CANCEL";
  return "UNKNOWN";
}

export function classifyPageActions(rawActions: RawPageAction[]): ApplicationActionAssessment[] {
  return rawActions.map((item) => classifyApplicationAction(item, rawActions));
}

export function pickTrustedAction(
  assessments: ApplicationActionAssessment[],
  action: ApplicationActionKind,
): ApplicationActionAssessment | null {
  const matches = assessments.filter((item) => item.action === action && item.trusted);
  if (matches.length !== 1) return null;
  return matches[0] ?? null;
}
