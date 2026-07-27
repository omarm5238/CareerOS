import {
  filterSkillLikeItems,
  estimateLearningEffort,
  isValidSkillName,
} from "@/features/shared/insights";

import type {
  SkillsEvidenceStatus,
  SkillsInsightAnalysisInput,
  SkillsInsightPrioritySkill,
  SkillsInsightProjectIdea,
  SkillsInsightResult,
} from "./types";

function buildMarketSignals(input: SkillsInsightAnalysisInput): string[] {
  const signals: string[] = [];
  const { overview, jobs } = input;

  if (overview.savedJobsAnalyzedCount === 0 || jobs.length === 0) {
    signals.push(
      "No market-driven skill gaps yet. Add saved jobs to compare your resume against job requirements.",
    );
    return signals;
  }

  if (overview.missingSkillsFromJobs.length > 0) {
    const topMissing = overview.missingSkillsFromJobs.slice(0, 4).join(", ");
    signals.push(`Saved jobs repeatedly mention ${topMissing}.`);
  }

  if (overview.matchedSkillsFromJobs.length > 0) {
    const topMatched = overview.matchedSkillsFromJobs.slice(0, 4).join(", ");
    signals.push(`Your resume aligns with ${topMatched} across saved jobs.`);
  }

  const strongJobs = jobs.filter((job) => job.matchScore >= 70).length;
  if (strongJobs > 0) {
    signals.push(
      `${strongJobs} saved job${strongJobs === 1 ? "" : "s"} show strong or partial alignment.`,
    );
  }

  return signals.slice(0, 5);
}

function evidenceStatusFor(
  skill: string,
  detectedSet: Set<string>,
  missingSet: Set<string>,
): SkillsEvidenceStatus {
  const key = skill.toLowerCase();
  if (detectedSet.has(key) && missingSet.has(key)) return "partially_supported";
  if (detectedSet.has(key)) return "supported";
  if (missingSet.has(key)) return "missing_from_resume";
  return "needs_proof_first";
}

function learningTargetFor(skill: string): string {
  if (/docker/i.test(skill)) {
    return "Dockerfile, docker-compose, environment variables, PostgreSQL service.";
  }
  if (/spring|java/i.test(skill)) {
    return "REST controllers, service layer, validation, JPA repositories.";
  }
  if (/javascript|typescript/i.test(skill)) {
    return "Core syntax, async patterns, and one real feature built end-to-end.";
  }
  return `Core ${skill} concepts you can explain and demonstrate in a small project.`;
}

function enrichPrioritySkill(
  skill: string,
  priority: SkillsInsightPrioritySkill["priority"],
  reason: string,
  evidence: string,
  detectedSet: Set<string>,
  missingSet: Set<string>,
): SkillsInsightPrioritySkill {
  const evidenceStatus = evidenceStatusFor(skill, detectedSet, missingSet);
  const resumeSafe = evidenceStatus === "supported";

  return {
    skill,
    priority,
    reason,
    evidence,
    resumeSafe,
    evidenceStatus,
    whyThisMatters: reason,
    currentEvidence: evidence,
    learningTarget: learningTargetFor(skill),
    proofProject: concreteProjectFor(skill, []).description ?? `Build a small project using ${skill}.`,
    estimatedHours: estimateLearningEffort(skill).label,
    resumeRule: resumeSafe
      ? "Safe to keep/add if experience is already visible on the resume."
      : `Add ${skill} only after you can show project or work evidence.`,
  };
}

function concreteProjectFor(skill: string, extras: string[]): SkillsInsightProjectIdea {
  const covered = [skill, ...extras].filter(isValidSkillName).slice(0, 3);
  if (/docker/i.test(skill)) {
    return {
      title: "Dockerized Resume Analyzer Sandbox",
      skills: covered,
      skillsCovered: covered,
      description:
        "Containerize a small backend service with PostgreSQL and a worker-style analysis endpoint.",
      output: "Docker Compose setup + documented run command",
      estimatedHours: estimateLearningEffort(skill).label,
      proof: "Mention Docker only if the repo proves it.",
      resumeProof: "Mention Docker only if the repo proves it.",
    };
  }
  if (/spring|java/i.test(skill)) {
    return {
      title: "Backend Job Tracker API",
      skills: covered.length > 0 ? covered : ["Java Spring Boot", "PostgreSQL", "REST APIs"],
      skillsCovered: covered.length > 0 ? covered : ["Java Spring Boot", "PostgreSQL", "REST APIs"],
      description:
        "Build a REST API to save job postings, track application status, and calculate match metadata.",
      output: "GitHub repo with README, API routes, sample data",
      estimatedHours: estimateLearningEffort(skill).label,
      proof: "Add as a backend project only after documented local setup.",
      resumeProof: "Add as a backend project only after documented local setup.",
    };
  }
  return {
    title: `${skill} proof project`,
    skills: covered,
    skillsCovered: covered,
    description: `Build a small runnable project that clearly demonstrates ${skill} in a realistic workflow.`,
    output: "GitHub repo with README and sample usage",
    estimatedHours: estimateLearningEffort(skill).label,
    proof: `Add ${skill} to resume only after the project is complete.`,
    resumeProof: `Add ${skill} to resume only after the project is complete.`,
  };
}

export function buildFallbackSkillsInsight(
  input: SkillsInsightAnalysisInput,
  options: { aiWarnings?: string[] } = {},
): SkillsInsightResult {
  const { overview, resume, jobs } = input;
  const detectedSet = new Set(resume.detectedSkills.map((skill) => skill.toLowerCase()));
  const missingSkills = filterSkillLikeItems(overview.missingSkillsFromJobs);
  const missingSet = new Set(missingSkills.map((skill) => skill.toLowerCase()));

  const warnings = [...(options.aiWarnings ?? [])];
  if (overview.detectedSkills.length === 0) {
    warnings.push(
      "No skills were detected on your resume — upload a clearer resume or add a skills section.",
    );
  }

  const hasJobs = jobs.length > 0 && overview.savedJobsAnalyzedCount > 0;

  let prioritySkills: SkillsInsightPrioritySkill[] = [];

  if (hasJobs) {
    prioritySkills = overview.prioritySkills
      .filter((item) => isValidSkillName(item.skill))
      .slice(0, 6)
      .map((item) =>
        enrichPrioritySkill(
          item.skill,
          item.priority,
          item.reason.includes("missing")
            ? `Saved roles mention ${item.skill} and your resume does not clearly prove it.`
            : item.reason,
          item.demandSignal,
          detectedSet,
          missingSet,
        ),
      );

    if (prioritySkills.length === 0 && missingSkills.length > 0) {
      prioritySkills = missingSkills.slice(0, 4).map((skill, index) =>
        enrichPrioritySkill(
          skill,
          index === 0 ? "High" : "Medium",
          `Appears in saved job requirements and is missing from your resume.`,
          `Missing from resume; present in saved job analyses.`,
          detectedSet,
          missingSet,
        ),
      );
    }
  } else {
    warnings.push(
      "No saved jobs yet. Add at least one target job to generate market-driven skill priorities.",
    );
  }

  const topGap = missingSkills[0];
  const secondGap = missingSkills[1];

  const learningRoadmap = [];
  if (hasJobs && topGap) {
    learningRoadmap.push({
      title: `Close the gap on ${topGap}`,
      skills: [topGap, ...(secondGap ? [secondGap] : [])],
      timeframe: "1-2 weeks",
      outcome: `Build one small project that demonstrates ${topGap} and can be linked from your resume.`,
    });
  }

  const projectIdeas =
    hasJobs && topGap
      ? [
          concreteProjectFor(
            topGap,
            resume.detectedSkills.filter(isValidSkillName).slice(0, 2),
          ),
          ...(secondGap
            ? [
                concreteProjectFor(
                  secondGap,
                  resume.detectedSkills.filter(isValidSkillName).slice(0, 1),
                ),
              ]
            : []),
        ].slice(0, 4)
      : [];

  const resumeSkillAdvice = hasJobs
    ? [
        ...resume.detectedSkills.filter(isValidSkillName).slice(0, 4).map((skill) => ({
          skill,
          advice:
            "You already have evidence for this skill — make it explicit in your skills or experience section.",
          action: "Add to resume" as const,
        })),
        ...missingSkills.slice(0, 4).map((skill) => ({
          skill,
          advice: `Do not add ${skill} to your resume until you can show a project or work example.`,
          action: "Add evidence first" as const,
        })),
      ].slice(0, 6)
    : [];

  return {
    skillCoverageScore: overview.skillCoverageScore,
    prioritySkills,
    learningRoadmap: learningRoadmap.slice(0, 4),
    projectIdeas,
    resumeSkillAdvice,
    marketSignals: buildMarketSignals(input),
    warnings: warnings.slice(0, 4),
    analysisSource: "rule_based",
    aiModel: null,
  };
}
