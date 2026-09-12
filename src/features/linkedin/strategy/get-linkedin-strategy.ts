import { prisma } from "@/server/db/prisma";

import { toStrategyView } from "../lib/views";

export async function getLinkedinStrategy(userId: string) {
  const active = await prisma.linkedinGrowthProfile.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { pillars: { orderBy: { createdAt: "asc" } } },
  });
  if (active) return toStrategyView(active);

  const latest = await prisma.linkedinGrowthProfile.findFirst({
    where: { userId, status: { in: ["DRAFT", "NEEDS_REFRESH"] } },
    orderBy: { updatedAt: "desc" },
    include: { pillars: { orderBy: { createdAt: "asc" } } },
  });
  return latest ? toStrategyView(latest) : null;
}

export async function listLinkedinPillars(userId: string) {
  const strategy = await getLinkedinStrategy(userId);
  return strategy?.pillars ?? [];
}
