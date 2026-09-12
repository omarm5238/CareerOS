import { prisma } from "@/server/db/prisma";

import { getActiveGrowthProfile, isContentFormat, isPostObjective, LinkedinAccessError } from "../lib/permissions";
import { toPostView } from "../lib/views";
import { getLinkedinPost } from "./get-linkedin-post";

export async function createLinkedinPost(
  userId: string,
  input: {
    ideaId?: string;
    pillarId?: string;
    objective?: string;
    format?: string;
    intendedAudience?: string;
  },
) {
  const profile = await getActiveGrowthProfile(userId);
  if (!profile) throw new LinkedinAccessError("NOT_FOUND", "Activate a LinkedIn strategy first.");

  const created = await prisma.$transaction(async (tx) => {
    return tx.linkedinPost.create({
      data: {
        userId,
        linkedinGrowthProfileId: profile.id,
        contentIdeaId: input.ideaId ?? null,
        pillarId: input.pillarId ?? profile.pillars[0]?.id ?? null,
        objective: isPostObjective(input.objective) ? input.objective : "SHOW_LEARNING",
        format: isContentFormat(input.format) ? input.format : "TEXT_POST",
        intendedAudience: input.intendedAudience ?? "Hiring managers",
        status: "DRAFT",
      },
    });
  });

  return getLinkedinPost(userId, created.id);
}

export { toPostView };
