import {
  actionTitleFamilyFor,
  canonicalActionTitleKey,
  canonicalizeActionTitle,
  classifyInsightItem,
  isValidSkillName,
  type ActionTitleFamily,
} from "@/features/shared/insights";

import type { ResumeModuleAnalysis } from "../types";
import type { TargetJobContext } from "@/features/jobs";
import type {
  ResumeEvidenceRule,
  ResumeImprovementCenterData,
  ResumeImprovementGroup,
  ResumeImprovementItem,
  ResumeImprovementPriority,
} from "../types/resume-improvement";

type BriefResumeFix = {
  title: string;
  reason?: string;
  priority?: string;
};

const PRIORITY_WEIGHT: Record<ResumeImprovementPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function priorityFromText(
  value: string | undefined,
  fallback: ResumeImprovementPriority,
): ResumeImprovementPriority {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "low") return "low";
  return fallback;
}

function groupForFamily(family: ActionTitleFamily | undefined): ResumeImprovementGroup | null {
  if (
    family === "quantified-achievements" ||
    family === "project-portfolio-links" ||
    family === "teamwork-proof"
  ) {
    return "Proof & Evidence";
  }
  if (
    family === "bullet-formatting" ||
    family === "section-headers" ||
    family === "contact-formatting"
  ) {
    return "Clarity & Formatting";
  }
  if (family === "role-keywords") return "ATS & Keywords";
  if (family === "certifications-training" || family === "education-timeline") {
    return "Content & Structure";
  }
  return null;
}

function guessWhereToFix(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("summary") || lower.includes("profile")) return "Summary";
  if (lower.includes("project")) return "Projects";
  if (lower.includes("education")) return "Education";
  if (lower.includes("experience") || lower.includes("work")) return "Experience";
  if (lower.includes("skill")) return "Skills";
  return "Resume overall";
}

function guessGroup(text: string): ResumeImprovementGroup {
  const lower = text.toLowerCase();
  if (lower.includes("ats") || lower.includes("keyword")) return "ATS & Keywords";
  if (lower.includes("proof") || lower.includes("evidence") || lower.includes("project")) {
    return "Proof & Evidence";
  }
  if (lower.includes("gap") || lower.includes("missing") || lower.includes("experience")) {
    return "Experience Gaps";
  }
  if (lower.includes("format") || lower.includes("bullet") || lower.includes("clarity") || lower.includes("section")) {
    return "Clarity & Formatting";
  }
  return "Content & Structure";
}

function evidenceRuleFor(text: string): ResumeEvidenceRule {
  const lower = text.toLowerCase();
  if (lower.includes("do not") || lower.includes("don't") || lower.includes("avoid claiming")) {
    return "do_not_add_yet";
  }
  if (lower.includes("proof") || lower.includes("evidence") || lower.includes("project first")) {
    return "needs_proof_first";
  }
  if (lower.includes("if available") || lower.includes("if you can prove") || lower.includes("only if true")) {
    return "needs_proof_first";
  }
  return "add_now";
}

function toItem(
  rawTitle: string,
  reason: string,
  priority: ResumeImprovementPriority,
  index: number,
  targetJobContext?: TargetJobContext,
): ResumeImprovementItem {
  const family = actionTitleFamilyFor(rawTitle);
  const title =
    family?.key === "role-keywords" && targetJobContext?.selectedJobTitle
      ? `Align resume keywords to ${targetJobContext.selectedJobTitle}`
      : canonicalizeActionTitle(rawTitle);
  const safeReason =
    family?.key === "role-keywords"
      ? `${reason} Only add keywords that match real experience or project evidence.`
      : reason;
  const context = `${title} ${safeReason}`;

  return {
    id: `resume-fix-${index}-${title.slice(0, 24).toLowerCase().replace(/\s+/g, "-")}`,
    title: title.slice(0, 140),
    priority,
    reason: safeReason.slice(0, 280),
    whereToFix: guessWhereToFix(context),
    exampleImprovement: null,
    evidenceRule: evidenceRuleFor(context),
    group: groupForFamily(family?.key) ?? guessGroup(context),
  };
}

function dedupeKeyFor(item: ResumeImprovementItem): string {
  return canonicalActionTitleKey(item.title);
}

function pushUnique(
  byKey: Map<string, ResumeImprovementItem>,
  item: ResumeImprovementItem,
) {
  const key = dedupeKeyFor(item);
  const existing = byKey.get(key);

  if (!existing) {
    byKey.set(key, item);
    return;
  }

  // Keep the highest severity; keep the more informative reason.
  const keepNew =
    PRIORITY_WEIGHT[item.priority] < PRIORITY_WEIGHT[existing.priority];
  const merged: ResumeImprovementItem = {
    ...(keepNew ? item : existing),
    reason:
      existing.reason.length >= item.reason.length ? existing.reason : item.reason,
  };
  byKey.set(key, merged);
}

export function buildResumeImprovementCenter(input: {
  analysis: ResumeModuleAnalysis;
  briefResumeFixes?: BriefResumeFix[];
  targetJobContext?: TargetJobContext;
}): ResumeImprovementCenterData {
  const { analysis, briefResumeFixes = [], targetJobContext } = input;
  const byKey = new Map<string, ResumeImprovementItem>();
  let index = 0;

  for (const tip of analysis.atsRecommendations) {
    if (
      actionTitleFamilyFor(tip)?.key === "role-keywords" &&
      !targetJobContext?.hasSelectedJob
    ) {
      continue;
    }
    pushUnique(
      byKey,
      toItem(
        tip,
        "From ATS recommendations on your latest resume analysis.",
        "high",
        index++,
        targetJobContext,
      ),
    );
  }

  for (const weakness of analysis.weaknesses) {
    if (
      actionTitleFamilyFor(weakness)?.key === "role-keywords" &&
      !targetJobContext?.hasSelectedJob
    ) {
      continue;
    }
    pushUnique(
      byKey,
      toItem(
        weakness,
        "Identified as a weakness in your latest resume analysis.",
        "high",
        index++,
        targetJobContext,
      ),
    );
  }

  for (const focus of analysis.suggestedFocus) {
    if (
      actionTitleFamilyFor(focus)?.key === "role-keywords" &&
      !targetJobContext?.hasSelectedJob
    ) {
      continue;
    }
    if (isValidSkillName(focus) && classifyInsightItem(focus) === "skill_gap") {
      pushUnique(
        byKey,
        toItem(
          `Make ${focus} evidence clearer on your resume`,
          "Suggested focus skill — only strengthen if you have real experience.",
          "medium",
          index++,
          targetJobContext,
        ),
      );
      continue;
    }

    pushUnique(
      byKey,
      toItem(
        focus,
        "Suggested focus from your resume analysis.",
        "medium",
        index++,
        targetJobContext,
      ),
    );
  }

  for (const warning of (analysis as { aiWarnings?: string[] }).aiWarnings ?? []) {
    pushUnique(
      byKey,
      toItem(warning, "Analysis warning to address carefully.", "medium", index++),
    );
  }

  if (analysis.completenessScore < 70) {
    pushUnique(
      byKey,
      toItem(
        "Raise resume completeness before applying widely",
        `Current completeness is ${analysis.completenessScore}%. Fill missing sections first.`,
        "high",
        index++,
      ),
    );
  }

  if (analysis.detectedSkills.length < 5) {
    pushUnique(
      byKey,
      toItem(
        "Clarify a dedicated Skills section with real, evidenced skills only",
        "Few skills were detected. Add a clear skills list for skills you can actually demonstrate.",
        "high",
        index++,
      ),
    );
  }

  for (const fix of briefResumeFixes) {
    if (
      actionTitleFamilyFor(fix.title)?.key === "role-keywords" &&
      !targetJobContext?.hasSelectedJob
    ) {
      continue;
    }
    pushUnique(
      byKey,
      toItem(
        fix.title,
        fix.reason ?? "From your CareerOS Brief resume fixes.",
        priorityFromText(fix.priority, "medium"),
        index++,
        targetJobContext,
      ),
    );
  }

  const items = Array.from(byKey.values());

  const groupOrder: ResumeImprovementGroup[] = [
    "Content & Structure",
    "ATS & Keywords",
    "Proof & Evidence",
    "Experience Gaps",
    "Clarity & Formatting",
  ];

  const groups = groupOrder
    .map((group) => ({
      group,
      items: items
        .filter((item) => item.group === group)
        .sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
        .slice(0, 6),
    }))
    .filter((entry) => entry.items.length > 0);

  return {
    groups,
    itemCount: groups.reduce((sum, group) => sum + group.items.length, 0),
  };
}
