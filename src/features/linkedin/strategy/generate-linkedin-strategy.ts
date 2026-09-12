import { prisma } from "@/server/db/prisma";

import { generateLinkedinJson } from "../ai/generate-linkedin-json";
import { buildLinkedinCareerContext } from "../context/build-linkedin-career-context";
import { flagUnsupportedPositioning } from "../lib/claim-safety";
import { toPrismaJson } from "../lib/json-parsers";
import { isGrowthGoal, LinkedinAccessError } from "../lib/permissions";
import { toStrategyView } from "../lib/views";
import { generateContentPillars } from "../pillars/generate-content-pillars";
import type { LinkedinGrowthGoal, LinkedinStrategyView } from "../types";
import { LINKEDIN_GROWTH_GOALS } from "../types";

type StrategyAiOutput = {
  primaryGoal?: string;
  secondaryGoals?: string[];
  targetAudience?: string[];
  positioningStatement?: string;
  contentTone?: string;
  preferredLanguage?: string;
  postingFrequencyTarget?: number;
  professionalThemes?: string[];
  pillars?: Array<{
    name?: string;
    description?: string;
    priority?: string;
    reason?: string;
    evidenceIds?: string[];
    exampleAngles?: string[];
  }>;
};

export async function generateLinkedinStrategy(
  userId: string,
  input: { primaryGoal?: LinkedinGrowthGoal } = {},
): Promise<LinkedinStrategyView> {
  const context = await buildLinkedinCareerContext(userId);
  const primaryGoal = input.primaryGoal && isGrowthGoal(input.primaryGoal) ? input.primaryGoal : "GET_HIRED";

  const ai = await generateLinkedinJson<StrategyAiOutput>({
    taskName: "linkedin-strategy",
    systemPrompt:
      "You create factual LinkedIn growth strategies. Never invent employment, seniority, certifications, clients, or metrics. Return JSON only.",
    userPrompt: JSON.stringify({
      instruction: "Propose a conservative LinkedIn strategy and 3-5 pillars grounded only in evidence.",
      primaryGoal,
      context,
    }),
  });

  const fallback = buildFallbackStrategy(primaryGoal, context.targetRoles, context.verifiedSkills);
  const payload = ai.ok ? { ...fallback, ...ai.data } : fallback;
  const positioning =
    (payload.positioningStatement ?? "").trim() ||
    fallback.positioningStatement;
  const warnings = flagUnsupportedPositioning(positioning, context);
  const safePositioning = warnings.some((item) => item.code === "unsupported_seniority")
    ? fallback.positioningStatement
    : positioning;

  const created = await prisma.linkedinGrowthProfile.create({
    data: {
      userId,
      primaryGoal: isGrowthGoal(payload.primaryGoal) ? payload.primaryGoal : primaryGoal,
      secondaryGoalsJson: toPrismaJson(
        (payload.secondaryGoals ?? []).filter(isGrowthGoal).slice(0, 3),
      ),
      targetRoleTitlesJson: toPrismaJson(context.targetRoles.slice(0, 8)),
      targetAudienceJson: toPrismaJson(
        (payload.targetAudience ?? fallback.targetAudience).slice(0, 8),
      ),
      positioningStatement: safePositioning,
      professionalThemesJson: toPrismaJson(
        (payload.professionalThemes ?? context.professionalThemes).slice(0, 8),
      ),
      postingFrequencyTarget:
        typeof payload.postingFrequencyTarget === "number" && payload.postingFrequencyTarget > 0
          ? Math.min(7, Math.round(payload.postingFrequencyTarget))
          : 2,
      status: "DRAFT",
      lastStrategyRefreshAt: new Date(),
    },
  });

  const pillarSpecs = (payload.pillars ?? fallback.pillars)
    .filter((pillar) => pillar.name && pillar.description)
    .slice(0, 5);
  await generateContentPillars(userId, created.id, pillarSpecs, context);

  const view = await prisma.linkedinGrowthProfile.findFirstOrThrow({
    where: { id: created.id, userId },
    include: { pillars: { orderBy: { createdAt: "asc" } } },
  });
  const result = toStrategyView(view);
  result.warnings = [...context.warnings, ...warnings];
  return result;
}

function buildFallbackStrategy(
  primaryGoal: LinkedinGrowthGoal,
  roles: string[],
  skills: string[],
): Required<Pick<StrategyAiOutput, "primaryGoal" | "secondaryGoals" | "targetAudience" | "positioningStatement" | "professionalThemes" | "postingFrequencyTarget" | "pillars">> {
  const role = roles[0] ?? "software professional";
  const skill = skills[0] ?? "practical engineering work";
  return {
    primaryGoal,
    secondaryGoals: LINKEDIN_GROWTH_GOALS.filter((goal) => goal !== primaryGoal).slice(0, 2),
    targetAudience: ["Hiring managers", "Recruiters", "Peer engineers"],
    positioningStatement: `I am building a clear professional presence around ${role} work and ${skill}, based on verified CareerOS evidence.`,
    professionalThemes: skills.slice(0, 5),
    postingFrequencyTarget: 2,
    pillars: [
      {
        name: "Verified skills",
        description: `Share what I am practicing in ${skill} without overstating expertise.`,
        priority: "CORE",
        exampleAngles: ["What I practiced this week", "A concrete debugging lesson"],
        evidenceIds: skills.slice(0, 3),
      },
      {
        name: "Project evidence",
        description: "Document real project work and what I learned from it.",
        priority: "CORE",
        exampleAngles: ["A shipping constraint I solved", "A tradeoff I would repeat"],
        evidenceIds: [],
      },
      {
        name: "Career positioning",
        description: `Connect recent work to ${role} conversations.`,
        priority: "SECONDARY",
        exampleAngles: ["Why this role family fits my evidence", "A requirement I am actively building"],
        evidenceIds: roles.slice(0, 2),
      },
    ],
  };
}

export function assertUsefulPillarCount(count: number) {
  if (count < 3 || count > 5) {
    throw new LinkedinAccessError("INVALID_INPUT", "A strategy should keep 3–5 active pillars.");
  }
}

