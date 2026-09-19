import { prisma } from "@/server/db/prisma";

import { CareerMemoryAccessError } from "../errors";
import { deactivateRelationsForMemory } from "../graph/sync";
import { toPrismaJson } from "../lib/json";
import { getOrCreateCareerMemoryPreference } from "../preferences/get-or-create";

export async function deleteCareerMemory(userId: string, id: string) {
  const memory = await prisma.careerMemory.findFirst({ where: { id, userId }, select: { id: true } });
  if (!memory) throw new CareerMemoryAccessError("NOT_FOUND", "Memory not found.");
  await deactivateRelationsForMemory(userId, memory.id);
  await prisma.careerMemoryEvidence.deleteMany({ where: { careerMemoryId: memory.id, userId } });
  await prisma.careerMemoryEvent.create({
    data: {
      userId,
      careerMemoryId: null,
      eventType: "DELETED",
      source: "USER_DECLARED",
      reason: "Single memory deleted.",
      afterJson: toPrismaJson({ event: "DELETED", memoryOpaqueId: memory.id, timestamp: new Date().toISOString() }),
    },
  });
  await prisma.careerMemory.delete({ where: { id: memory.id } });
}

export async function deleteAllCareerMemory(userId: string) {
  await prisma.careerMemoryEvidence.deleteMany({ where: { userId } });
  await prisma.careerGraphRelation.deleteMany({ where: { userId } });
  await prisma.careerGraphEntity.deleteMany({ where: { userId } });
  await prisma.careerMemory.deleteMany({ where: { userId } });
  await prisma.careerMemoryEvent.deleteMany({ where: { userId } });
  const preference = await getOrCreateCareerMemoryPreference(userId);
  await prisma.careerMemoryPreference.update({
    where: { id: preference.id },
    data: { memoryResetAt: new Date() },
  });
  await prisma.careerMemoryEvent.create({
    data: {
      userId,
      eventType: "RESET",
      source: "USER_DECLARED",
      reason: "Delete all career memory.",
      afterJson: toPrismaJson({ event: "RESET", timestamp: new Date().toISOString() }),
    },
  });
}
