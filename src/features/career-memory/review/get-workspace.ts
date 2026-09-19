import { prisma } from "@/server/db/prisma";

import { getCareerGraphView } from "../graph/sync";
import { toMemoryView } from "../lib/views";
import { getOrCreateCareerMemoryPreference, toPreferenceView } from "../preferences/get-or-create";
import type { MemoryWorkspaceView } from "../types";

export async function getCareerMemoryWorkspace(userId: string): Promise<MemoryWorkspaceView> {
  const preference = toPreferenceView(await getOrCreateCareerMemoryPreference(userId));
  const memories = await prisma.careerMemory.findMany({
    where: { userId, status: { in: ["ACTIVE", "CONTRADICTED", "SUPPRESSED", "EXPIRED"] } },
    include: { evidence: true },
    orderBy: [{ importance: "desc" }, { lastObservedAt: "desc" }],
    take: 80,
  });
  const views = memories.map(toMemoryView);
  return {
    preferences: preference,
    memories: views.filter((item) => item.status === "ACTIVE"),
    needsReview: views.filter((item) => item.status === "CONTRADICTED"),
    graph: await getCareerGraphView(userId),
    empty: views.filter((item) => item.status === "ACTIVE").length === 0,
  };
}

export async function getOwnedMemoryView(userId: string, id: string) {
  const memory = await prisma.careerMemory.findFirst({
    where: { id, userId },
    include: { evidence: true },
  });
  return memory ? toMemoryView(memory) : null;
}
