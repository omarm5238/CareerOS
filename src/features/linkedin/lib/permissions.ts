import { prisma } from "@/server/db/prisma";

import type {
  LinkedinContentFormat,
  LinkedinContentIdeaStatus,
  LinkedinContentLanguage,
  LinkedinContentPillarPriority,
  LinkedinContentTone,
  LinkedinGrowthGoal,
  LinkedinPostObjective,
  LinkedinPostRevisionSource,
  LinkedinPostStatus,
} from "@/generated/prisma/client";

import {
  LINKEDIN_CONTENT_FORMATS,
  LINKEDIN_GROWTH_GOALS,
  LINKEDIN_IDEA_STATUSES,
  LINKEDIN_LANGUAGES,
  LINKEDIN_PILLAR_PRIORITIES,
  LINKEDIN_POST_OBJECTIVES,
  LINKEDIN_POST_STATUSES,
  LINKEDIN_REVISION_SOURCES,
  LINKEDIN_TONES,
  LINKEDIN_TRANSFORM_TYPES,
  type LinkedinTransformType,
} from "../types";

export class LinkedinAccessError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT";

  constructor(code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT", message: string) {
    super(message);
    this.name = "LinkedinAccessError";
    this.code = code;
  }
}

const ACCESS_ERROR_STATUS: Record<LinkedinAccessError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  CONFLICT: 409,
};

export function toLinkedinErrorResponse(error: unknown): { status: number; message: string } | null {
  if (!(error instanceof LinkedinAccessError)) return null;
  return { status: ACCESS_ERROR_STATUS[error.code], message: error.message };
}

export function isGrowthGoal(value: unknown): value is LinkedinGrowthGoal {
  return typeof value === "string" && (LINKEDIN_GROWTH_GOALS as readonly string[]).includes(value);
}

export function isPillarPriority(value: unknown): value is LinkedinContentPillarPriority {
  return typeof value === "string" && (LINKEDIN_PILLAR_PRIORITIES as readonly string[]).includes(value);
}

export function isIdeaStatus(value: unknown): value is LinkedinContentIdeaStatus {
  return typeof value === "string" && (LINKEDIN_IDEA_STATUSES as readonly string[]).includes(value);
}

export function isContentFormat(value: unknown): value is LinkedinContentFormat {
  return typeof value === "string" && (LINKEDIN_CONTENT_FORMATS as readonly string[]).includes(value);
}

export function isPostObjective(value: unknown): value is LinkedinPostObjective {
  return typeof value === "string" && (LINKEDIN_POST_OBJECTIVES as readonly string[]).includes(value);
}

export function isPostStatus(value: unknown): value is LinkedinPostStatus {
  return typeof value === "string" && (LINKEDIN_POST_STATUSES as readonly string[]).includes(value);
}

export function isTone(value: unknown): value is LinkedinContentTone {
  return typeof value === "string" && (LINKEDIN_TONES as readonly string[]).includes(value);
}

export function isLanguage(value: unknown): value is LinkedinContentLanguage {
  return typeof value === "string" && (LINKEDIN_LANGUAGES as readonly string[]).includes(value);
}

export function isRevisionSource(value: unknown): value is LinkedinPostRevisionSource {
  return typeof value === "string" && (LINKEDIN_REVISION_SOURCES as readonly string[]).includes(value);
}

export function isTransformType(value: unknown): value is LinkedinTransformType {
  return typeof value === "string" && (LINKEDIN_TRANSFORM_TYPES as readonly string[]).includes(value);
}

export async function assertOwnedGrowthProfile(userId: string, profileId: string) {
  const row = await prisma.linkedinGrowthProfile.findFirst({
    where: { id: profileId, userId },
  });
  if (!row) throw new LinkedinAccessError("NOT_FOUND", "LinkedIn strategy not found.");
  return row;
}

export async function assertOwnedPillar(userId: string, pillarId: string) {
  const row = await prisma.linkedinContentPillar.findFirst({
    where: { id: pillarId, userId },
  });
  if (!row) throw new LinkedinAccessError("NOT_FOUND", "Content pillar not found.");
  return row;
}

export async function assertOwnedIdea(userId: string, ideaId: string) {
  const row = await prisma.linkedinContentIdea.findFirst({
    where: { id: ideaId, userId },
  });
  if (!row) throw new LinkedinAccessError("NOT_FOUND", "Content idea not found.");
  return row;
}

export async function assertOwnedPost(userId: string, postId: string) {
  const row = await prisma.linkedinPost.findFirst({
    where: { id: postId, userId },
    include: {
      revisions: { orderBy: { revisionNumber: "asc" } },
      activeRevision: true,
      pillar: true,
      publishingPlans: { orderBy: { createdAt: "desc" } },
      performances: { orderBy: { capturedAt: "desc" } },
    },
  });
  if (!row) throw new LinkedinAccessError("NOT_FOUND", "LinkedIn post not found.");
  return row;
}

export async function assertOwnedPlan(userId: string, planId: string) {
  const row = await prisma.linkedinPublishingPlan.findFirst({
    where: { id: planId, userId },
    include: {
      linkedinPost: true,
      linkedinPostRevision: true,
    },
  });
  if (!row) throw new LinkedinAccessError("NOT_FOUND", "Publishing plan not found.");
  return row;
}

export async function getActiveGrowthProfile(userId: string) {
  return prisma.linkedinGrowthProfile.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { pillars: { where: { isActive: true }, orderBy: { createdAt: "asc" } } },
  });
}
