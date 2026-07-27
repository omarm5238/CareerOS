import { classifyRequirement } from "./classify-requirement";

export type LearningEffort = {
  label:
    | "3–5h"
    | "4–6h"
    | "4–8h"
    | "6–10h"
    | "8–12h"
    | "8–14h"
    | "12–18h"
    | "12–20h"
    | "18–25h"
    | "Focused pass"
    | "Project-based proof"
    | "Portfolio proof over time"
    | "Evidence gap — cannot be solved by short study hours."
    | "Context requirement — address only if true.";
  intensity: "low" | "medium" | "high";
  rationale: string;
  /** Only technical skills/projects should display hour ranges in UI. */
  showHours: boolean;
};

export function estimateLearningEffort(requirement: string): LearningEffort {
  const classified = classifyRequirement(requirement);
  if (classified.kind === "experience_gap") {
    return {
      label: "Evidence gap — cannot be solved by short study hours.",
      intensity: "high",
      rationale: "Seniority and professional experience require truthful evidence over time.",
      showHours: false,
    };
  }
  if (classified.kind === "evidence_gap") {
    return {
      label: "Portfolio proof over time",
      intensity: "medium",
      rationale: "Build and document a credible artifact rather than claiming unsupported experience.",
      showHours: false,
    };
  }
  if (classified.kind === "context_requirement") {
    return {
      label: "Context requirement — address only if true.",
      intensity: "low",
      rationale: "This is an eligibility or role-context requirement, not a learnable skill.",
      showHours: false,
    };
  }

  const value = requirement.toLowerCase();
  if (/\bgit\b/.test(value)) {
    return effort("3–5h", "low", "Core Git workflow and collaboration basics.");
  }
  if (/\bdjango rest|drf\b/.test(value)) {
    return effort("4–6h", "low", "Cover serializers, views, and one authenticated endpoint.");
  }
  if (/\brest(?:ful)?(?:\s+apis?)?\b/.test(value)) {
    return effort("4–6h", "low", "Build and test a small REST endpoint.");
  }
  if (/\bmigration/.test(value)) {
    return effort("4–6h", "low", "Practice one schema change with rollback notes.");
  }
  if (/\bwebsockets?\b/.test(value)) {
    return effort("4–8h", "medium", "Learn connection lifecycle and build a small live feature.");
  }
  if (/\bdjango\b|\bflask\b|\bfastapi\b/.test(value)) {
    return effort("6–10h", "medium", "Cover framework basics through a small API.");
  }
  if (/\bpython\b|\bphp\b|\bnode(?:\.js|js)?\b/.test(value)) {
    return effort("6–10h", "medium", "Cover language/runtime fundamentals with a focused exercise.");
  }
  if (/\bpostgres(?:ql)?\b|\bsql\b/.test(value)) {
    return effort("6–10h", "medium", "Practice schema design, queries, and indexing basics.");
  }
  if (/\bdocker\b/.test(value)) {
    return effort("6–10h", "medium", "Containerize and run one small application.");
  }
  if (/\bgo concurrency\b|\bgoroutines?\b|\bchannels?\b|\bconcurrency\b/.test(value)) {
    return effort("6–10h", "medium", "Practice goroutines, channels, and cancellation.");
  }
  if (/^(go|golang)$/i.test(requirement.trim()) || /\bgolang\b/.test(value)) {
    return effort("6–10h", "medium", "Build a small Go HTTP service with tests.");
  }
  if (/\bmicroservices?\b/.test(value)) {
    return effort("8–14h", "high", "Learn service boundaries and implement a small integration.");
  }
  if (/\bkubernetes operators?\b/.test(value)) {
    return effort("18–25h", "high", "Operators require Kubernetes and controller-pattern foundations.");
  }
  if (/\bkubernetes\b|\bk8s\b/.test(value)) {
    return effort("12–18h", "high", "Deploy and inspect a small workload locally.");
  }
  if (/\baws\b|\bcloud\b|\bterraform\b/.test(value)) {
    return effort("12–18h", "high", "Cover core cloud concepts with one deployed proof.");
  }
  if (/\bbig data\b|\bspark\b|\bhadoop\b|\bmachine learning\b|\bai\b/.test(value)) {
    return effort("12–18h", "high", "Build a focused data/ML integration exercise.");
  }
  // Low-confidence technical label — avoid a fake universal hour band.
  return {
    label: "Focused pass",
    intensity: "medium",
    rationale: "Conservative estimate until the skill depth is clearer from the job text.",
    showHours: false,
  };
}

function effort(
  label: LearningEffort["label"],
  intensity: LearningEffort["intensity"],
  rationale: string,
): LearningEffort {
  return { label, intensity, rationale, showHours: true };
}
