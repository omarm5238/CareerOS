import { prisma } from "@/server/db/prisma";

import type { CareerMemoryPreferenceView } from "../types";

export async function getOrCreateCareerMemoryPreference(userId: string) {
  const existing = await prisma.careerMemoryPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.careerMemoryPreference.create({
    data: {
      userId,
      memoryEnabled: true,
      allowBehavioralMemory: true,
      allowDerivedPatterns: true,
      allowLongTermPreferences: true,
    },
  });
}

export function toPreferenceView(
  row: Awaited<ReturnType<typeof getOrCreateCareerMemoryPreference>>,
): CareerMemoryPreferenceView {
  return {
    memoryEnabled: row.memoryEnabled,
    allowBehavioralMemory: row.allowBehavioralMemory,
    allowDerivedPatterns: row.allowDerivedPatterns,
    allowLongTermPreferences: row.allowLongTermPreferences,
    memoryResetAt: row.memoryResetAt?.toISOString() ?? null,
    lastRefreshedAt: row.lastRefreshedAt?.toISOString() ?? null,
  };
}

export async function updateCareerMemoryPreference(
  userId: string,
  patch: Partial<{
    memoryEnabled: boolean;
    allowBehavioralMemory: boolean;
    allowDerivedPatterns: boolean;
    allowLongTermPreferences: boolean;
  }>,
) {
  const current = await getOrCreateCareerMemoryPreference(userId);
  return prisma.careerMemoryPreference.update({
    where: { id: current.id },
    data: {
      memoryEnabled: typeof patch.memoryEnabled === "boolean" ? patch.memoryEnabled : current.memoryEnabled,
      allowBehavioralMemory:
        typeof patch.allowBehavioralMemory === "boolean" ? patch.allowBehavioralMemory : current.allowBehavioralMemory,
      allowDerivedPatterns:
        typeof patch.allowDerivedPatterns === "boolean" ? patch.allowDerivedPatterns : current.allowDerivedPatterns,
      allowLongTermPreferences:
        typeof patch.allowLongTermPreferences === "boolean"
          ? patch.allowLongTermPreferences
          : current.allowLongTermPreferences,
    },
  });
}
