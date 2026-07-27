import { canonicalizeActionTitle } from "@/features/shared/insights";

import type {
  ResumeActionItem,
  ResumeActionPriority,
  ResumeActionSource,
  ResumeModuleAnalysis,
} from "../types";

type ActionDomain = "design" | "software" | "general";

type CandidateAction = Omit<ResumeActionItem, "id"> & {
  rank: number;
  fingerprint: string;
};

const MAX_ACTIONS = 6;

const SOFTWARE_ONLY_TERMS = [
  "system design",
  "cloud deployment",
  "kubernetes",
  "docker",
  "rest api",
  "postgresql",
  "mongodb",
  "unit test",
  "jest",
  "cypress",
  "backend",
  "frontend engineer",
  "full stack",
  "typescript",
  "node.js",
  "react",
  "next.js",
];

const DESIGN_ROLE_TERMS = [
  "graphic",
  "visual",
  "brand",
  "motion",
  "designer",
  "creative",
  "ui/visual",
];

const SOFTWARE_ROLE_TERMS = [
  "engineer",
  "developer",
  "software",
  "full stack",
  "frontend",
  "backend",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function inferDomain(analysis: ResumeModuleAnalysis): ActionDomain {
  const role = normalize(analysis.role);
  const skills = normalize(analysis.detectedSkills.join(" "));
  const focus = normalize(analysis.suggestedFocus.join(" "));
  const combined = `${role} ${skills} ${focus}`;

  if (includesAny(role, DESIGN_ROLE_TERMS) || includesAny(skills, ["photoshop", "illustrator", "figma", "typography", "branding"])) {
    return "design";
  }

  if (includesAny(role, SOFTWARE_ROLE_TERMS) || includesAny(combined, ["javascript", "typescript", "react", "node.js", "postgresql"])) {
    return "software";
  }

  return "general";
}

function isSoftwareOnlyText(text: string): boolean {
  return includesAny(normalize(text), SOFTWARE_ONLY_TERMS);
}

function fingerprintFromTitle(title: string): string {
  return normalize(title)
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)
    .join("-");
}

function createCandidate(input: {
  title: string;
  priority: ResumeActionPriority;
  reason: string;
  suggestedFix: string;
  source: ResumeActionSource;
  rank: number;
}): CandidateAction {
  const title = canonicalizeActionTitle(input.title);
  return {
    ...input,
    title,
    fingerprint: fingerprintFromTitle(title),
  };
}

function collectCorpus(analysis: ResumeModuleAnalysis): string {
  return normalize(
    [
      analysis.role,
      analysis.experienceLevel,
      analysis.profileSummary ?? "",
      ...analysis.weaknesses,
      ...analysis.atsRecommendations,
      ...analysis.suggestedFocus,
      ...analysis.detectedSkills,
      ...analysis.strengths,
    ].join(" "),
  );
}

function hasSignal(corpus: string, terms: string[]): boolean {
  return includesAny(corpus, terms);
}

function buildPortfolioAction(domain: ActionDomain, corpus: string): CandidateAction | null {
  const hasPortfolioEvidence = hasSignal(corpus, [
    "behance",
    "dribbble",
    "github.com",
    "portfolio link",
  ]);
  const hasPortfolioGap = hasSignal(corpus, [
    "portfolio case studies",
    "limited evidence for portfolio",
    "missing portfolio",
    "no portfolio",
    "project samples",
  ]);

  // If portfolio is already evidenced and no gap was flagged, skip.
  if (hasPortfolioEvidence && !hasPortfolioGap) {
    return null;
  }

  // If neither gap nor absence is clear, still recommend for design/software when portfolio terms are weak.
  const mentionsPortfolio = hasSignal(corpus, ["portfolio", "case study", "github"]);
  if (mentionsPortfolio && !hasPortfolioGap && domain === "general") {
    return null;
  }

  if (domain === "design") {
    return createCandidate({
      title: "Add portfolio link",
      priority: "High",
      reason:
        "The analysis indicates limited or missing portfolio and project samples for a design profile.",
      suggestedFix:
        "Add a Behance, Dribbble, or personal portfolio link near the top of the resume, and include 2–3 short case-study highlights.",
      source: "Missing Item",
      rank: 1,
    });
  }

  if (domain === "software") {
    return createCandidate({
      title: "Highlight projects or GitHub",
      priority: "High",
      reason:
        "Project samples or a public code portfolio strengthen software profiles and hiring confidence.",
      suggestedFix:
        "Add a GitHub or project portfolio link, and list 2–3 projects with tech stack and measurable outcomes.",
      source: "Missing Item",
      rank: 1,
    });
  }

  return createCandidate({
    title: "Add work samples or portfolio",
    priority: "High",
    reason: "Visible work samples help employers quickly validate your experience.",
    suggestedFix:
      "Add a portfolio, personal website, or selected project samples near the top of the resume.",
    source: "Missing Item",
    rank: 1,
  });
}

function buildAchievementAction(corpus: string): CandidateAction | null {
  if (hasSignal(corpus, ["measurable", "metrics", "achievement", "%", "increased", "reduced", "roi", "kpi"])) {
    return null;
  }

  return createCandidate({
    title: "Add measurable achievements",
    priority: "High",
    reason: "The analysis shows limited evidence of quantified outcomes or impact statements.",
    suggestedFix:
      "Rewrite 2–3 experience bullets with metrics such as growth %, time saved, audience reach, or delivery outcomes.",
    source: "Missing Item",
    rank: 2,
  });
}

function buildEducationAction(corpus: string): CandidateAction | null {
  if (hasSignal(corpus, ["education", "university", "degree", "bachelor", "certification", "certified"])) {
    return null;
  }

  return createCandidate({
    title: "Clarify education or certifications",
    priority: "Medium",
    reason: "Education or certification details appear incomplete or unclear in the current analysis.",
    suggestedFix:
      "Add a concise Education section and list relevant certifications with institution and year.",
    source: "Missing Item",
    rank: 3,
  });
}

function buildSkillsGapAction(
  analysis: ResumeModuleAnalysis,
  domain: ActionDomain,
): CandidateAction | null {
  if (analysis.detectedSkills.length >= 4) {
    return null;
  }

  if (domain === "design") {
    return createCandidate({
      title: "Expand design tools and skills",
      priority: "Medium",
      reason: "Few design skills were detected, which can weaken ATS and recruiter scanning.",
      suggestedFix:
        "Add a clear Skills section with tools such as Photoshop, Illustrator, Figma, typography, branding, and layout design when accurate.",
      source: "Skills Gap",
      rank: 4,
    });
  }

  if (domain === "software") {
    return createCandidate({
      title: "Expand technical skills list",
      priority: "Medium",
      reason: "The analysis detected a limited technical skill set for a software profile.",
      suggestedFix:
        "Add a focused Skills section with languages, frameworks, databases, and tools that appear in your experience.",
      source: "Skills Gap",
      rank: 4,
    });
  }

  return createCandidate({
    title: "Clarify core skills",
    priority: "Medium",
    reason: "Few skills were detected, which can make the profile harder to scan quickly.",
    suggestedFix:
      "Add a concise Skills section with your strongest role-relevant capabilities near the top of the resume.",
    source: "Skills Gap",
    rank: 4,
  });
}

function mapSuggestedFocusToAction(
  focus: string,
  domain: ActionDomain,
): CandidateAction | null {
  const normalized = normalize(focus);

  if (domain === "design" && isSoftwareOnlyText(normalized)) {
    return null;
  }

  if (domain === "software" && includesAny(normalized, ["brand identity", "motion design", "client presentation"])) {
    // still allow if software CV somehow has these; keep them low
  }

  let priority: ResumeActionPriority = "Medium";
  let suggestedFix = `Strengthen your resume around “${focus}” with concrete examples and clearer wording.`;
  let rank = 6;

  if (includesAny(normalized, ["portfolio", "case stud"])) {
    priority = "High";
    rank = 1;
    suggestedFix =
      domain === "design"
        ? "Add 2–3 portfolio case studies with problem, process, and outcome, plus a live portfolio link."
        : "Add project case studies with problem, approach, stack, and outcome.";
  } else if (includesAny(normalized, ["brand identity", "visual identity"])) {
    priority = "High";
    rank = 6;
    suggestedFix =
      "Document one brand identity system example covering logo, typography, color, and application samples.";
  } else if (includesAny(normalized, ["testing", "cloud", "system design", "database"])) {
    if (domain === "design") return null;
    priority = "Medium";
    rank = 6;
    suggestedFix = `Add evidence of ${focus.toLowerCase()} through projects, tools used, or measurable delivery outcomes.`;
  } else if (includesAny(normalized, ["motion"])) {
    priority = "Medium";
    rank = 6;
    suggestedFix =
      "Include one motion sample or After Effects/Premiere project with a short process note.";
  }

  return createCandidate({
    title: `Improve ${focus}`,
    priority,
    reason: `Suggested focus from analysis: ${focus}.`,
    suggestedFix,
    source: "Suggested Focus",
    rank,
  });
}

function mapWeaknessToAction(
  weakness: string,
  domain: ActionDomain,
  index: number,
): CandidateAction | null {
  const normalized = normalize(weakness);

  if (domain === "design" && isSoftwareOnlyText(normalized)) {
    return null;
  }

  if (includesAny(normalized, ["portfolio", "case stud", "project"])) {
    return createCandidate({
      title: "Strengthen portfolio evidence",
      priority: "High",
      reason: weakness,
      suggestedFix:
        domain === "design"
          ? "Add portfolio links and short case studies that show process and visual outcomes."
          : "Add project samples with clear outcomes and links where possible.",
      source: "Missing Item",
      rank: 1,
    });
  }

  if (includesAny(normalized, ["achievement", "metric", "measurable", "result"])) {
    return createCandidate({
      title: "Clarify impact statements",
      priority: "High",
      reason: weakness,
      suggestedFix:
        "Convert vague responsibilities into impact bullets with numbers, scope, or outcomes.",
      source: "Missing Item",
      rank: 2,
    });
  }

  if (includesAny(normalized, ["education", "certif"])) {
    return createCandidate({
      title: "Complete education details",
      priority: "Medium",
      reason: weakness,
      suggestedFix: "Add education and certifications with institution names and dates.",
      source: "Missing Item",
      rank: 3,
    });
  }

  if (includesAny(normalized, ["skill"])) {
    return createCandidate({
      title: "Clarify skill coverage",
      priority: "Medium",
      reason: weakness,
      suggestedFix: "List role-relevant skills in a dedicated section and mirror them in experience bullets.",
      source: "Skills Gap",
      rank: 4,
    });
  }

  return createCandidate({
    title: `Address: ${weakness.slice(0, 48)}${weakness.length > 48 ? "…" : ""}`,
    priority: "Low",
    reason: weakness,
    suggestedFix: "Revise the related resume section with clearer evidence and concise wording.",
    source: "Missing Item",
    rank: 5 + index,
  });
}

function mapAtsToAction(
  recommendation: string,
  domain: ActionDomain,
): CandidateAction | null {
  const normalized = normalize(recommendation);

  if (domain === "design" && isSoftwareOnlyText(normalized)) {
    return null;
  }

  let priority: ResumeActionPriority = "Medium";
  let rank = 5;

  if (includesAny(normalized, ["portfolio", "project"])) {
    priority = "High";
    rank = 1;
  } else if (includesAny(normalized, ["measurable", "outcome", "metric"])) {
    priority = "High";
    rank = 2;
  } else if (includesAny(normalized, ["heading", "format", "ats", "simple", "skills near"])) {
    priority = "Medium";
    rank = 5;
  }

  return createCandidate({
    title: recommendation.length > 56 ? `${recommendation.slice(0, 53)}…` : recommendation,
    priority,
    reason: "This recommendation came from ATS-oriented analysis of your resume structure.",
    suggestedFix: recommendation,
    source: "ATS Recommendation",
    rank,
  });
}

function dedupeAndCap(candidates: CandidateAction[]): ResumeActionItem[] {
  const seen = new Set<string>();
  const sorted = [...candidates].sort((a, b) => {
    const priorityWeight = { High: 0, Medium: 1, Low: 2 };
    const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.rank - b.rank;
  });

  const selected: ResumeActionItem[] = [];

  for (const candidate of sorted) {
    if (seen.has(candidate.fingerprint)) continue;
    // Soft dedupe on overlapping keywords
    const overlap = [...seen].some((existing) => {
      const a = existing.split("-");
      const b = candidate.fingerprint.split("-");
      const shared = a.filter((token) => b.includes(token) && token.length > 3);
      return shared.length >= 2;
    });
    if (overlap) continue;

    seen.add(candidate.fingerprint);
    selected.push({
      id: `action-${selected.length + 1}-${candidate.fingerprint}`,
      title: candidate.title,
      priority: candidate.priority,
      reason: candidate.reason,
      suggestedFix: candidate.suggestedFix,
      source: candidate.source,
    });

    if (selected.length >= MAX_ACTIONS) break;
  }

  return selected;
}

export function generateResumeActionPlan(
  analysis: ResumeModuleAnalysis,
): ResumeActionItem[] {
  const domain = inferDomain(analysis);
  const corpus = collectCorpus(analysis);
  const candidates: CandidateAction[] = [];

  const portfolio = buildPortfolioAction(domain, corpus);
  if (portfolio) candidates.push(portfolio);

  const achievements = buildAchievementAction(corpus);
  if (achievements) candidates.push(achievements);

  const education = buildEducationAction(corpus);
  if (education) candidates.push(education);

  const skillsGap = buildSkillsGapAction(analysis, domain);
  if (skillsGap) candidates.push(skillsGap);

  analysis.suggestedFocus.forEach((focus) => {
    const action = mapSuggestedFocusToAction(focus, domain);
    if (action) candidates.push(action);
  });

  analysis.weaknesses.forEach((weakness, index) => {
    const action = mapWeaknessToAction(weakness, domain, index);
    if (action) candidates.push(action);
  });

  analysis.atsRecommendations.forEach((recommendation) => {
    const action = mapAtsToAction(recommendation, domain);
    if (action) candidates.push(action);
  });

  return dedupeAndCap(candidates);
}
