import type { SkillsInsightAnalysisInput, SkillsInsightResult } from "./types";

function buildMarketSignals(input: SkillsInsightAnalysisInput): string[] {
  const signals: string[] = [];
  const { overview, jobs } = input;

  if (overview.missingSkillsFromJobs.length > 0) {
    const topMissing = overview.missingSkillsFromJobs.slice(0, 4).join(", ");
    signals.push(`Saved jobs repeatedly mention ${topMissing}.`);
  }

  if (overview.matchedSkillsFromJobs.length > 0) {
    const topMatched = overview.matchedSkillsFromJobs.slice(0, 4).join(", ");
    signals.push(`Your resume aligns with ${topMatched} across saved jobs.`);
  }

  if (jobs.length > 0) {
    const strongJobs = jobs.filter((job) => job.matchScore >= 70).length;
    if (strongJobs > 0) {
      signals.push(`${strongJobs} saved job${strongJobs === 1 ? "" : "s"} show strong or partial alignment.`);
    }
  }

  if (overview.savedJobsAnalyzedCount === 0) {
    signals.push("Save and analyze jobs to sharpen market-driven skill priorities.");
  }

  return signals.slice(0, 6);
}

export function buildFallbackSkillsInsight(
  input: SkillsInsightAnalysisInput,
  options: { aiWarnings?: string[] } = {},
): SkillsInsightResult {
  const { overview, resume } = input;
  const detectedSet = new Set(
    resume.detectedSkills.map((skill) => skill.toLowerCase()),
  );

  const prioritySkills = overview.prioritySkills.slice(0, 8).map((item) => ({
    skill: item.skill,
    priority: item.priority,
    reason: item.reason,
    evidence: item.demandSignal,
    resumeSafe: detectedSet.has(item.skill.toLowerCase()),
  }));

  const topGap = overview.missingSkillsFromJobs[0];
  const secondGap = overview.missingSkillsFromJobs[1];

  const learningRoadmap = [];
  if (topGap) {
    learningRoadmap.push({
      title: `Close the gap on ${topGap}`,
      skills: [topGap, ...(secondGap ? [secondGap] : [])],
      timeframe: "1-2 weeks",
      outcome: `Build one small project that demonstrates ${topGap} and can be linked from your resume.`,
    });
  }

  if (overview.recommendations.length > 0) {
    learningRoadmap.push({
      title: "Strengthen resume-visible skills",
      skills: overview.detectedSkills.slice(0, 3),
      timeframe: "1 week",
      outcome: overview.recommendations[0] ?? "Make existing skills explicit on your resume.",
    });
  }

  const projectIdeas = topGap
    ? [
        {
          title: `Portfolio project featuring ${topGap}`,
          skills: [topGap, ...resume.detectedSkills.slice(0, 2)],
          proof: "Publish a GitHub repo or demo page and reference it under Projects on your resume.",
        },
      ]
    : [];

  const resumeSkillAdvice = [
    ...overview.detectedSkills.slice(0, 4).map((skill) => ({
      skill,
      advice: "You already have evidence for this skill — make it explicit in your skills or experience section.",
      action: "Add to resume" as const,
    })),
    ...overview.missingSkillsFromJobs.slice(0, 4).map((skill) => ({
      skill,
      advice: `Do not add ${skill} to your resume until you can show a project or work example.`,
      action: "Add evidence first" as const,
    })),
  ].slice(0, 8);

  const warnings = [...(options.aiWarnings ?? [])];
  if (overview.detectedSkills.length === 0) {
    warnings.push("No skills were detected on your resume — upload a clearer resume or add a skills section.");
  }

  return {
    skillCoverageScore: overview.skillCoverageScore,
    prioritySkills,
    learningRoadmap: learningRoadmap.slice(0, 5),
    projectIdeas: projectIdeas.slice(0, 5),
    resumeSkillAdvice,
    marketSignals: buildMarketSignals(input),
    warnings: warnings.slice(0, 6),
    analysisSource: "rule_based",
    aiModel: null,
  };
}
