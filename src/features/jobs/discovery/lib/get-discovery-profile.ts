import { prisma } from "@/server/db/prisma";
import type { JobDiscoveryProfileData, JobDiscoveryRoleTarget, JobDiscoveryLocationTarget, ProviderPreferences, WorkAuthorizationPreferences } from "../types";

function safeJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

function safeJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function parseDiscoveryProfileData(row: {
  roleTargetsJson: unknown;
  locationTargetsJson: unknown;
  workModesJson: unknown;
  employmentTypesJson: unknown;
  experienceLevelsJson: unknown;
  includedKeywordsJson: unknown;
  excludedKeywordsJson: unknown;
  workAuthorizationJson: unknown;
  visaPreference: string | null;
  freshnessDays: number;
  minimumSuitabilityScore: number;
  dailyTarget: number;
  providerPreferencesJson: unknown;
}): JobDiscoveryProfileData {
  return {
    roleTargets: safeJsonArray<JobDiscoveryRoleTarget>(row.roleTargetsJson),
    locationTargets: safeJsonArray<JobDiscoveryLocationTarget>(row.locationTargetsJson),
    workModes: safeJsonArray<string>(row.workModesJson),
    employmentTypes: safeJsonArray<string>(row.employmentTypesJson),
    experienceLevels: safeJsonArray<string>(row.experienceLevelsJson),
    includedKeywords: safeJsonArray<string>(row.includedKeywordsJson),
    excludedKeywords: safeJsonArray<string>(row.excludedKeywordsJson),
    workAuthorization: safeJsonRecord(row.workAuthorizationJson) as WorkAuthorizationPreferences,
    visaPreference: row.visaPreference,
    freshnessDays: row.freshnessDays,
    minimumSuitabilityScore: row.minimumSuitabilityScore,
    dailyTarget: row.dailyTarget,
    providerPreferences: safeJsonRecord(row.providerPreferencesJson) as ProviderPreferences,
  };
}

export async function getDiscoveryProfileForUser(userId: string) {
  const profile = await prisma.jobDiscoveryProfile.findUnique({
    where: { userId },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    userId: profile.userId,
    ...parseDiscoveryProfileData(profile),
    generatedFromContextAt: profile.generatedFromContextAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
