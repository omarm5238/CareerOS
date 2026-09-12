import { prisma } from "@/server/db/prisma";

import { assertOwnedGrowthProfile, LinkedinAccessError } from "../lib/permissions";
import { toStrategyView } from "../lib/views";

export async function activateLinkedinStrategy(userId: string, profileId?: string) {
  const target = profileId
    ? await assertOwnedGrowthProfile(userId, profileId)
    : await prisma.linkedinGrowthProfile.findFirst({
        where: { userId, status: { in: ["DRAFT", "NEEDS_REFRESH"] } },
        orderBy: { updatedAt: "desc" },
      });
  if (!target) throw new LinkedinAccessError("NOT_FOUND", "No draft strategy is available to activate.");

  const pillarCount = await prisma.linkedinContentPillar.count({
    where: { userId, linkedinGrowthProfileId: target.id, isActive: true },
  });
  if (pillarCount < 3) {
    throw new LinkedinAccessError("INVALID_INPUT", "Activate requires at least 3 active pillars.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.linkedinGrowthProfile.updateMany({
      where: { userId, status: "ACTIVE", id: { not: target.id } },
      data: { status: "ARCHIVED" },
    });
    return tx.linkedinGrowthProfile.update({
      where: { id: target.id },
      data: { status: "ACTIVE" },
      include: { pillars: { orderBy: { createdAt: "asc" } } },
    });
  });

  return toStrategyView(updated);
}
