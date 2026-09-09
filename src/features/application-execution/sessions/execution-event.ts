import type { ApplicationExecutionEventType, Prisma } from "@/generated/prisma/client";

import { prisma } from "@/server/db/prisma";

import { toPrismaJson } from "../lib/json-parsers";

const SENSITIVE_KEYS = /password|otp|mfa|secret|ssn|race|gender|ethnicity|disability|veteran/i;

function scrub(metadata: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.test(key)) continue;
    if (typeof value === "string" && SENSITIVE_KEYS.test(value)) continue;
    next[key] = value;
  }
  return next;
}

export async function recordExecutionEvent(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    userId: string;
    executionSessionId: string;
    type: ApplicationExecutionEventType;
    message: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.applicationExecutionEvent.create({
    data: {
      userId: input.userId,
      executionSessionId: input.executionSessionId,
      type: input.type,
      message: input.message,
      metadataJson: toPrismaJson(scrub(input.metadata ?? {})),
    },
  });
}
