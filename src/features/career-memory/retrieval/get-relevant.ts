import { prisma } from "@/server/db/prisma";

import { getOrCreateCareerMemoryPreference, toPreferenceView } from "../preferences/get-or-create";
import { toMemoryView } from "../lib/views";
import { MEMORY_DEFAULT_CAP, MEMORY_REVIEW_CAP, MEMORY_TODAY_CAP } from "../types";
import type { CareerMemoryView, MemoryContextType, StructuredMemoryContext } from "../types";

const EMPTY: StructuredMemoryContext = {
  focus: [],
  skills: [],
  evidenceGaps: [],
  preferences: [],
  patterns: [],
  constraints: [],
  milestones: [],
};

function capFor(contextType: MemoryContextType): number {
  if (contextType === "TODAY_PLANNING") return MEMORY_TODAY_CAP;
  if (contextType === "WEEKLY_REVIEW") return MEMORY_REVIEW_CAP;
  return MEMORY_DEFAULT_CAP;
}

function rank(memory: CareerMemoryView, contextType: MemoryContextType): number {
  let score = memory.confidence === "HIGH" ? 30 : memory.confidence === "MEDIUM" ? 18 : 8;
  score += memory.importance === "HIGH" ? 20 : memory.importance === "MEDIUM" ? 10 : 4;
  score += memory.isUserCorrected ? 12 : memory.isUserDeclared ? 10 : 0;
  if (contextType === "TODAY_PLANNING" && (memory.category === "EVIDENCE" || memory.type === "BEHAVIOR_PATTERN")) score += 8;
  if (contextType === "WEEKLY_REVIEW" && (memory.type === "CAREER_PATTERN" || memory.category === "EVIDENCE")) score += 8;
  if (contextType === "SKILL_PLANNING" && (memory.category === "SKILL" || memory.category === "EVIDENCE")) score += 10;
  return score;
}

function bucket(memories: CareerMemoryView[]): StructuredMemoryContext {
  return {
    focus: memories.filter((item) => item.type === "FOCUS" || item.category === "CAREER_TARGET"),
    skills: memories.filter((item) => item.category === "SKILL" || item.type === "SKILL_SIGNAL"),
    evidenceGaps: memories.filter((item) => item.subjectKey === "skill.gap" || item.category === "EVIDENCE"),
    preferences: memories.filter((item) => item.type === "PREFERENCE"),
    patterns: memories.filter((item) => item.type === "BEHAVIOR_PATTERN" || item.type === "CAREER_PATTERN"),
    constraints: memories.filter((item) => item.type === "CONSTRAINT"),
    milestones: memories.filter((item) => item.type === "MILESTONE"),
  };
}

export async function getRelevantCareerMemory(input: {
  userId: string;
  contextType: MemoryContextType;
  maxItems?: number;
}): Promise<StructuredMemoryContext> {
  const preference = toPreferenceView(await getOrCreateCareerMemoryPreference(input.userId));
  if (!preference.memoryEnabled) return EMPTY;
  const rows = await prisma.careerMemory.findMany({
    where: { userId: input.userId, status: "ACTIVE" },
    include: { evidence: true },
    orderBy: { lastObservedAt: "desc" },
    take: 80,
  });
  const usable = rows
    .map(toMemoryView)
    .filter((item) => item.confidence !== "LOW" || item.isUserDeclared || item.type === "MILESTONE" || item.importance === "HIGH")
    .sort((a, b) => rank(b, input.contextType) - rank(a, input.contextType))
    .slice(0, input.maxItems ?? capFor(input.contextType));
  return bucket(usable);
}

export function emptyMemoryContext(): StructuredMemoryContext {
  return EMPTY;
}
