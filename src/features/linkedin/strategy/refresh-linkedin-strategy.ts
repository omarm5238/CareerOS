import { prisma } from "@/server/db/prisma";

import { buildLinkedinCareerContext } from "../context/build-linkedin-career-context";
import { sha1Fingerprint } from "../lib/fingerprint";
import { LinkedinAccessError } from "../lib/permissions";
import { generateLinkedinStrategy } from "./generate-linkedin-strategy";
import { getLinkedinStrategy } from "./get-linkedin-strategy";

export async function refreshLinkedinStrategy(userId: string) {
  const current = await getLinkedinStrategy(userId);
  if (!current) {
    throw new LinkedinAccessError("NOT_FOUND", "Create a strategy before refreshing it.");
  }

  const context = await buildLinkedinCareerContext(userId);
  const currentFingerprint = sha1Fingerprint(
    JSON.stringify({
      roles: current.targetRoleTitles,
      themes: current.professionalThemes,
      positioning: current.positioningStatement,
    }),
  );

  if (current.status === "ACTIVE") {
    await prisma.linkedinGrowthProfile.update({
      where: { id: current.id },
      data: { status: context.fingerprint === currentFingerprint ? "ACTIVE" : "NEEDS_REFRESH" },
    });
  }

  return generateLinkedinStrategy(userId, { primaryGoal: current.primaryGoal });
}
