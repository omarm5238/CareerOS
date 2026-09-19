export type SubjectCardinality = "SINGLE" | "MULTI";

const SINGLE_SUBJECTS = new Set(["focus.primary", "role.primary", "goal.primary"]);

export function subjectCardinality(subjectKey: string): SubjectCardinality {
  return SINGLE_SUBJECTS.has(subjectKey) ? "SINGLE" : "MULTI";
}

export function isHardContradiction(subjectKey: string, left: string, right: string): boolean {
  return subjectCardinality(subjectKey) === "SINGLE" && left !== right;
}
