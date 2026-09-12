import type { LinkedinCareerContext, LinkedinEvidenceStrength, LinkedinPriorityBreakdown } from "../types";

export function scoreLinkedinIdea(input: {
  context: LinkedinCareerContext;
  title: string;
  evidenceStrength: LinkedinEvidenceStrength;
  pillarMatch: boolean;
  audienceMatch: boolean;
  freshness: "fresh" | "recent" | "stale";
  topic?: string;
}): LinkedinPriorityBreakdown {
  const topic = (input.topic ?? input.title).toLowerCase();
  const careerHit = input.context.targetRoles.some((role) => topic.includes(role.toLowerCase())) ||
    input.context.jobRequirementPatterns.some((pattern) => topic.includes(pattern.name.toLowerCase())) ||
    input.context.verifiedSkills.some((skill) => topic.includes(skill.toLowerCase()));
  const careerRelevance = careerHit ? 30 : input.context.verifiedSkills.length > 0 ? 18 : 8;
  const evidenceStrength = input.evidenceStrength === "STRONG" ? 25 : input.evidenceStrength === "MODERATE" ? 16 : 8;
  const audienceFit = input.audienceMatch ? 20 : 12;
  const pillarFit = input.pillarMatch ? 15 : 7;
  const freshness = input.freshness === "fresh" ? 10 : input.freshness === "recent" ? 6 : 2;
  return {
    careerRelevance,
    evidenceStrength,
    audienceFit,
    pillarFit,
    freshness,
    total: careerRelevance + evidenceStrength + audienceFit + pillarFit + freshness,
  };
}

export function recruiterRelevanceFromTopic(
  context: LinkedinCareerContext,
  topic: string,
): "LOW" | "MEDIUM" | "HIGH" {
  const needle = topic.toLowerCase();
  const requirement = context.jobRequirementPatterns.find((item) => needle.includes(item.name.toLowerCase()));
  if (requirement && requirement.count >= 3) return "HIGH";
  if (requirement || context.targetRoles.some((role) => needle.includes(role.toLowerCase()))) return "MEDIUM";
  return "LOW";
}
