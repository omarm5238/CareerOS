import { prisma } from "@/server/db/prisma";
import type { ApplicationPreparationMode } from "@/generated/prisma/client";

import { OpportunityAccessError } from "@/features/jobs/opportunities/lib/permissions";

export async function setApplicationPreparationMode(
  userId: string,
  modeRaw: unknown,
) {
  if (modeRaw !== "MANUAL" && modeRaw !== "ASSISTED" && modeRaw !== "AUTO_PREPARE") {
    throw new OpportunityAccessError("INVALID_INPUT", "Choose Manual, Assisted, or Auto Prepare.");
  }
  const mode = modeRaw as ApplicationPreparationMode;
  await prisma.jobDiscoveryProfile.upsert({
    where: { userId },
    create: { userId, applicationPreparationMode: mode },
    update: { applicationPreparationMode: mode },
  });
  return { mode };
}
