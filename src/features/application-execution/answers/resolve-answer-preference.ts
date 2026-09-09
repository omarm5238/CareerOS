import { prisma } from "@/server/db/prisma";

import type { ApplicationAnswerScope } from "@/generated/prisma/client";

import { nowMs } from "../lib/clock";
import { toPrismaJson } from "../lib/json-parsers";

function parseValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value && typeof (value as { value: unknown }).value === "string") {
    return (value as { value: string }).value;
  }
  return null;
}

export async function findAnswerPreference(
  userId: string,
  key: string,
  category: string,
  jobPostingId: string,
): Promise<{ value: string; preview: string; requiresPerApplicationConfirmation: boolean } | null> {
  const now = new Date(nowMs());
  const rows = await prisma.applicationAnswerPreference.findMany({
    where: {
      userId,
      key,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { updatedAt: "desc" },
  });
  const scoped =
    rows.find((row) => row.scopeType === "JOB_SPECIFIC" && row.scopeValue === jobPostingId) ??
    rows.find((row) => row.scopeType === "COUNTRY") ??
    rows.find((row) => row.scopeType === "PROVIDER") ??
    rows.find((row) => row.scopeType === "GLOBAL");
  if (!scoped) return null;
  if (category === "SENSITIVE") return null;
  const value = parseValue(scoped.valueJson);
  if (!value) return null;
  return {
    value,
    preview: category === "LEGAL" ? "Previous answer available" : value,
    requiresPerApplicationConfirmation: scoped.requiresPerApplicationConfirmation || category === "LEGAL",
  };
}

export async function saveAnswerPreference(input: {
  userId: string;
  key: string;
  category: string;
  value: string;
  scopeType: ApplicationAnswerScope;
  scopeValue: string;
  requiresPerApplicationConfirmation: boolean;
}): Promise<void> {
  if (input.category === "SENSITIVE") return;
  await prisma.applicationAnswerPreference.upsert({
    where: {
      userId_key_scopeType_scopeValue: {
        userId: input.userId,
        key: input.key,
        scopeType: input.scopeType,
        scopeValue: input.scopeType === "GLOBAL" ? "" : input.scopeValue,
      },
    },
    create: {
      userId: input.userId,
      key: input.key,
      category: input.category,
      scopeType: input.scopeType,
      scopeValue: input.scopeType === "GLOBAL" ? "" : input.scopeValue,
      valueJson: toPrismaJson({ value: input.value }),
      requiresPerApplicationConfirmation: input.requiresPerApplicationConfirmation || input.category === "LEGAL",
      confirmedAt: new Date(nowMs()),
    },
    update: {
      valueJson: toPrismaJson({ value: input.value }),
      confirmedAt: new Date(nowMs()),
    },
  });
}
