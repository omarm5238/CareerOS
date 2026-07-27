export type SelectedTargetDeltaData = {
  jobTitle: string;
  company: string;
  matchScore: number | null;
  missingTechnicalSkills: string[];
  nonSkillBlockers: string[];
  nextMove: string;
};

export function buildSelectedTargetDelta(input: {
  jobTitle: string;
  company: string;
  matchScore: number | null | undefined;
  missingTechnicalSkills: string[];
  experienceGaps?: string[];
  evidenceGaps?: string[];
  contextRequirements?: string[];
}): SelectedTargetDeltaData {
  const missingTechnicalSkills = input.missingTechnicalSkills
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 3);

  const nonSkillBlockers = [
    ...(input.experienceGaps ?? []),
    ...(input.evidenceGaps ?? []),
    ...(input.contextRequirements ?? []),
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);

  const matchScore =
    typeof input.matchScore === "number" && Number.isFinite(input.matchScore)
      ? input.matchScore
      : null;

  let nextMove = "Tailor your resume summary and apply.";
  if (matchScore === null) {
    nextMove = "Analyze this job against your resume.";
  } else if (missingTechnicalSkills[0]) {
    nextMove = `Build proof for ${missingTechnicalSkills[0]} before applying.`;
  } else if (nonSkillBlockers[0]) {
    nextMove = `Add truthful evidence for ${nonSkillBlockers[0]}.`;
  }

  return {
    jobTitle: input.jobTitle,
    company: input.company,
    matchScore,
    missingTechnicalSkills,
    nonSkillBlockers,
    nextMove,
  };
}
