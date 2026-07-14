import type { ResumeModuleAnalysis } from "@/features/resume";

import { extractJobSignals, extractJobSkills } from "./extract-job-signals";
import type { RuleBasedJobMatchCore, RoleAlignment } from "../types";

type AnalyzeJobMatchInput = {
  title: string;
  description: string;
  resume: Pick<
    ResumeModuleAnalysis,
    "role" | "experienceLevel" | "detectedSkills"
  > | null;
};

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function detectRoleAlignment(
  jobTitle: string,
  jobSignals: string[],
  resumeRole: string | undefined,
): RoleAlignment {
  if (!resumeRole) return "Unknown";

  const role = normalize(resumeRole);
  const title = normalize(jobTitle);
  const signals = jobSignals.map((signal) => normalize(signal));

  const designResume = role.includes("design") || role.includes("creative");
  const softwareResume =
    role.includes("engineer") ||
    role.includes("developer") ||
    role.includes("software") ||
    role.includes("stack");

  const designJob =
    signals.includes("design") ||
    title.includes("design") ||
    title.includes("creative");
  const softwareJob =
    signals.includes("frontend") ||
    signals.includes("backend") ||
    signals.includes("full stack") ||
    title.includes("engineer") ||
    title.includes("developer");

  if (designResume && designJob) return "Strong";
  if (softwareResume && softwareJob) {
    if (
      (role.includes("frontend") && signals.includes("frontend")) ||
      (role.includes("backend") && signals.includes("backend")) ||
      (role.includes("full stack") && signals.includes("full stack")) ||
      title.includes(normalize(resumeRole.split(" ")[0] ?? ""))
    ) {
      return "Strong";
    }
    return "Partial";
  }

  if ((designResume && softwareJob) || (softwareResume && designJob)) {
    return "Weak";
  }

  if (title.includes(role.split(" ")[0] ?? "") || role.includes(title.split(" ")[0] ?? "")) {
    return "Partial";
  }

  return "Weak";
}

function experienceAligned(
  resumeLevel: string | undefined,
  jobSignals: string[],
): boolean | null {
  if (!resumeLevel) return null;

  const level = normalize(resumeLevel);
  const seniorJob = jobSignals.includes("Senior-level");
  const entryJob = jobSignals.includes("Entry-level");
  const midJob = jobSignals.includes("Mid-level");

  if (level.includes("senior")) {
    if (seniorJob) return true;
    if (entryJob) return false;
    return midJob ? true : null;
  }

  if (level.includes("mid")) {
    if (midJob || seniorJob) return true;
    if (entryJob) return true;
    return null;
  }

  if (level.includes("entry") || level.includes("junior")) {
    if (entryJob || midJob) return true;
    if (seniorJob) return false;
  }

  return null;
}

export function analyzeJobMatchRuleBased(
  input: AnalyzeJobMatchInput,
): RuleBasedJobMatchCore {
  const jobSkills = extractJobSkills(`${input.title}\n${input.description}`);
  const jobSignals = extractJobSignals(input.title, input.description);
  const resumeSkills = input.resume?.detectedSkills ?? [];
  const resumeSignals: string[] = [];

  if (input.resume?.role) resumeSignals.push(input.resume.role);
  if (input.resume?.experienceLevel) {
    resumeSignals.push(input.resume.experienceLevel);
  }
  if (resumeSkills.length > 0) {
    resumeSignals.push(`${resumeSkills.length} detected skills`);
  }

  const matchedSkills = jobSkills.filter((skill) =>
    resumeSkills.some((resumeSkill) => resumeSkill.toLowerCase() === skill.toLowerCase()),
  );
  const missingSkills = jobSkills.filter(
    (skill) =>
      !resumeSkills.some((resumeSkill) => resumeSkill.toLowerCase() === skill.toLowerCase()),
  );

  const roleAlignment = detectRoleAlignment(
    input.title,
    jobSignals,
    input.resume?.role,
  );

  let score = input.resume ? 35 : 20;

  score += Math.min(30, matchedSkills.length * 6);
  score -= Math.min(24, missingSkills.length * 4);

  if (roleAlignment === "Strong") score += 18;
  else if (roleAlignment === "Partial") score += 8;
  else if (roleAlignment === "Weak") score -= 8;

  const experienceMatch = experienceAligned(
    input.resume?.experienceLevel,
    jobSignals,
  );
  if (experienceMatch === true) score += 8;
  if (experienceMatch === false) score -= 6;

  if (!input.resume) {
    score = Math.min(score, 40);
  }

  const recommendations: string[] = [];

  if (!input.resume) {
    recommendations.push("Upload or analyze a resume to improve matching.");
  }

  if (missingSkills.length > 0) {
    recommendations.push(
      `Highlight or develop: ${missingSkills.slice(0, 4).join(", ")}.`,
    );
  }

  if (matchedSkills.length > 0) {
    recommendations.push(
      `Emphasize matched skills in your application: ${matchedSkills.slice(0, 4).join(", ")}.`,
    );
  }

  if (roleAlignment === "Weak") {
    recommendations.push(
      "Role alignment looks weak — tailor your summary to this job’s domain before applying.",
    );
  } else if (roleAlignment === "Strong") {
    recommendations.push("Role alignment looks strong — prioritize this opportunity.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Review the job description and align your top experience bullets.");
  }

  return {
    matchScore: clampScore(score),
    roleAlignment,
    matchedSkills,
    missingSkills,
    resumeSignals,
    jobSignals,
    recommendations: recommendations.slice(0, 5),
  };
}
