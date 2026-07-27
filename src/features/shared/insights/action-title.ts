export type ActionTitleFamily =
  | "certifications-training"
  | "quantified-achievements"
  | "project-portfolio-links"
  | "education-timeline"
  | "teamwork-proof"
  | "bullet-formatting"
  | "section-headers"
  | "contact-formatting"
  | "role-keywords";

type FamilyDefinition = {
  key: ActionTitleFamily;
  pattern: RegExp;
  title: string;
};

const ACTION_TITLE_FAMILIES: FamilyDefinition[] = [
  {
    key: "certifications-training",
    pattern: /\b(certif|additional training|relevant training)\b/i,
    title: "Include certifications or relevant training if available",
  },
  {
    key: "quantified-achievements",
    pattern:
      /\b(quantif|measurable|impact metric|metrics|measurable result|impact statements?|achievement results?)\b/i,
    title: "Add measurable metrics to your strongest bullets",
  },
  {
    key: "project-portfolio-links",
    pattern: /\b(portfolio|github|live project|project link|links? to (live )?projects?)\b/i,
    title: "Add project or portfolio links you can prove",
  },
  {
    key: "education-timeline",
    pattern: /\b(education date|degree detail|graduation|education timeline|dates? (for|of) education)\b/i,
    title: "Add education dates and degree details if available",
  },
  {
    key: "teamwork-proof",
    pattern: /\b(soft skills?|teamwork|collaboration)\b/i,
    title: "Show teamwork through a real project example",
  },
  {
    key: "bullet-formatting",
    pattern: /\b(bullet|bullets|bullet point|action verb)\b/i,
    title: "Use concise, outcome-focused bullet points",
  },
  {
    key: "section-headers",
    pattern: /\b(section header|section heading|standard headings?|resume sections?)\b/i,
    title: "Use clear standard section headings",
  },
  {
    key: "contact-formatting",
    pattern: /\b(contact info|contact detail|email address|phone number|location format)\b/i,
    title: "Format contact information clearly",
  },
  {
    key: "role-keywords",
    pattern:
      /\b(role keywords?|target role terms?|job title keywords?|keywords?.*(?:job descriptions?|target roles?))\b/i,
    title: "Align role keywords against a saved target job",
  },
];

export function actionTitleFamilyFor(value: string): FamilyDefinition | null {
  for (const family of ACTION_TITLE_FAMILIES) {
    if (family.pattern.test(value)) return family;
  }
  return null;
}

export function canonicalizeActionTitle(raw: string): string {
  let title = raw.trim().replace(/\s+/g, " ");
  const family = actionTitleFamilyFor(title);
  if (family) return family.title;

  title = title
    .replace(
      /^(?:improve|enhance)\s+(include|add|use|provide|create|clarify|highlight|ensure|consider|list|show|format)\b/i,
      (_match, verb: string) =>
        verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase(),
    )
    .replace(/^(add|use|include|show|fix|format)\s+\1\b/i, "$1")
    .replace(/[.!?]+(\s*[.!?]+)*\s*$/, "")
    .trim();

  if (/^improve\s+.{70,}$/i.test(title)) {
    title = title.replace(/^improve\s+/i, "");
  }

  return title
    ? title.charAt(0).toUpperCase() + title.slice(1)
    : "Review this action";
}

export function canonicalActionTitleKey(raw: string): string {
  const family = actionTitleFamilyFor(raw);
  if (family) return family.key;

  return canonicalizeActionTitle(raw)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
