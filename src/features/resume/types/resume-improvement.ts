export type ResumeImprovementGroup =
  | "Content & Structure"
  | "ATS & Keywords"
  | "Proof & Evidence"
  | "Experience Gaps"
  | "Clarity & Formatting";

export type ResumeEvidenceRule = "add_now" | "needs_proof_first" | "do_not_add_yet";

export type ResumeImprovementPriority = "high" | "medium" | "low";

export type ResumeImprovementItem = {
  id: string;
  title: string;
  priority: ResumeImprovementPriority;
  reason: string;
  whereToFix: string;
  exampleImprovement: string | null;
  evidenceRule: ResumeEvidenceRule;
  group: ResumeImprovementGroup;
};

export type ResumeImprovementCenterData = {
  groups: Array<{
    group: ResumeImprovementGroup;
    items: ResumeImprovementItem[];
  }>;
  itemCount: number;
};
