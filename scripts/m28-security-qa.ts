import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import {
  CareerMemoryAccessError,
  confirmCareerMemory,
  correctCareerMemory,
  createUserDeclaredMemory,
  deleteAllCareerMemory,
  deleteCareerMemory,
  getCareerGraphView,
  getCareerMemoryWorkspace,
  getOwnedMemoryView,
  getOrCreateCareerMemoryPreference,
  refreshCareerMemory,
  restoreCareerMemory,
  suppressCareerMemory,
  updateCareerMemoryPreference,
} from "@/features/career-memory/server";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function expectNotFound(task: () => Promise<unknown>) {
  try {
    await task();
    return false;
  } catch (error) {
    return error instanceof CareerMemoryAccessError && error.code === "NOT_FOUND";
  }
}

async function cleanup(userId: string) {
  await prisma.careerMemoryEvidence.deleteMany({ where: { userId } });
  await prisma.careerGraphRelation.deleteMany({ where: { userId } });
  await prisma.careerGraphEntity.deleteMany({ where: { userId } });
  await prisma.careerMemoryEvent.deleteMany({ where: { userId } });
  await prisma.careerMemory.deleteMany({ where: { userId } });
  await prisma.careerMemoryPreference.deleteMany({ where: { userId } });
}

async function makeUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await cleanup(existing.id);
    return existing;
  }
  return prisma.user.create({ data: { email, name, emailVerified: false } });
}

async function run() {
  const userA = await makeUser("m28-sec-a@careeros.local", "M28 A");
  const userB = await makeUser("m28-sec-b@careeros.local", "M28 B");
  await cleanup(userA.id);
  await cleanup(userB.id);
  await getOrCreateCareerMemoryPreference(userA.id);
  await getOrCreateCareerMemoryPreference(userB.id);
  const memory = await createUserDeclaredMemory(userA.id, { category: "skill", value: "Go" });
  await refreshCareerMemory(userA.id, { mode: "ON_DEMAND" });

  evidence.crossUserRead = await expectNotFound(() => getOwnedMemoryView(userB.id, memory.id).then((row) => {
    if (!row) throw new CareerMemoryAccessError("NOT_FOUND", "Memory not found.");
    return row;
  }));
  evidence.crossUserConfirm = await expectNotFound(() => confirmCareerMemory(userB.id, memory.id));
  evidence.crossUserCorrect = await expectNotFound(() => correctCareerMemory(userB.id, memory.id, "Rust"));
  evidence.crossUserSuppress = await expectNotFound(() => suppressCareerMemory(userB.id, memory.id));
  evidence.crossUserRestore = await expectNotFound(() => restoreCareerMemory(userB.id, memory.id));
  evidence.crossUserDelete = await expectNotFound(() => deleteCareerMemory(userB.id, memory.id));

  const bWorkspace = await getCareerMemoryWorkspace(userB.id);
  evidence.crossUserWorkspaceHidden = !bWorkspace.memories.some((item) => item.id === memory.id);
  const bGraph = await getCareerGraphView(userB.id);
  evidence.crossUserGraph = !bGraph.nodes.some((node) => node.id === memory.id);

  await deleteAllCareerMemory(userB.id);
  const aStill = await prisma.careerMemory.findUnique({ where: { id: memory.id } });
  evidence.crossUserDeleteAll = Boolean(aStill);

  const created = await createUserDeclaredMemory(userA.id, {
    category: "skill",
    value: "TypeScript",
    confidence: "HIGH",
    sourceType: "USER_CORRECTED",
    isUserCorrected: true,
    userId: userB.id,
  } as Record<string, unknown>);
  evidence.forgedIgnored = {
    source: created.sourceType,
    confidence: created.confidence,
    userId: created.userId,
    corrected: created.isUserCorrected,
  };
  assert(created.sourceType === "USER_DECLARED", "Forged source ignored.");
  assert(created.userId === userA.id, "Forged userId ignored.");
  assert(created.isUserCorrected === false, "Forged corrected flag ignored.");

  await updateCareerMemoryPreference(userB.id, { memoryEnabled: false });
  const aPref = await getOrCreateCareerMemoryPreference(userA.id);
  evidence.crossUserPreferences = aPref.memoryEnabled === true;

  evidence.ok =
    evidence.crossUserConfirm &&
    evidence.crossUserCorrect &&
    evidence.crossUserSuppress &&
    evidence.crossUserDelete &&
    evidence.crossUserWorkspaceHidden &&
    evidence.crossUserDeleteAll &&
    created.sourceType === "USER_DECLARED";
  assert(evidence.ok, "Security matrix.");
  console.log(JSON.stringify({ ok: true, evidence }, null, 2));
}

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
