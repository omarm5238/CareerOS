import { prisma } from "@/server/db/prisma";

import { toPrismaJson } from "../lib/json-parsers";
import {
  assertOwnedGrowthProfile,
  isGrowthGoal,
  isLanguage,
  isTone,
  LinkedinAccessError,
} from "../lib/permissions";
import { toStrategyView } from "../lib/views";

export async function updateLinkedinStrategy(userId: string, body: Record<string, unknown>) {
  const profileId = typeof body.id === "string" ? body.id : null;
  const profile = profileId
    ? await assertOwnedGrowthProfile(userId, profileId)
    : await prisma.linkedinGrowthProfile.findFirst({
        where: { userId, status: { in: ["DRAFT", "NEEDS_REFRESH", "ACTIVE"] } },
        orderBy: { updatedAt: "desc" },
      });
  if (!profile) throw new LinkedinAccessError("NOT_FOUND", "LinkedIn strategy not found.");

  const secondaryGoals = Array.isArray(body.secondaryGoals)
    ? body.secondaryGoals.filter(isGrowthGoal).slice(0, 3)
    : undefined;

  const updated = await prisma.linkedinGrowthProfile.update({
    where: { id: profile.id },
    data: {
      primaryGoal: isGrowthGoal(body.primaryGoal) ? body.primaryGoal : undefined,
      secondaryGoalsJson: secondaryGoals ? toPrismaJson(secondaryGoals) : undefined,
      targetRoleTitlesJson: Array.isArray(body.targetRoleTitles)
        ? toPrismaJson(body.targetRoleTitles)
        : undefined,
      targetAudienceJson: Array.isArray(body.targetAudience)
        ? toPrismaJson(body.targetAudience)
        : undefined,
      positioningStatement:
        typeof body.positioningStatement === "string" ? body.positioningStatement.trim() : undefined,
      professionalThemesJson: Array.isArray(body.professionalThemes)
        ? toPrismaJson(body.professionalThemes)
        : undefined,
      contentTone: isTone(body.contentTone) ? body.contentTone : undefined,
      preferredLanguage: isLanguage(body.preferredLanguage) ? body.preferredLanguage : undefined,
      postingFrequencyTarget:
        typeof body.postingFrequencyTarget === "number" ? Math.max(1, Math.min(7, body.postingFrequencyTarget)) : undefined,
      visibilityGoal: typeof body.visibilityGoal === "string" ? body.visibilityGoal : undefined,
      recruiterGoal: typeof body.recruiterGoal === "string" ? body.recruiterGoal : undefined,
      networkGoal: typeof body.networkGoal === "string" ? body.networkGoal : undefined,
      profileSnapshotJson: body.profileSnapshot ? toPrismaJson(body.profileSnapshot) : undefined,
    },
    include: { pillars: { orderBy: { createdAt: "asc" } } },
  });

  return toStrategyView(updated);
}
