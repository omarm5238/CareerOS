import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { JobDiscoveryProfileData } from "../types";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function buildProfileFields(data: Partial<JobDiscoveryProfileData>, generated?: boolean) {
  const fields: Prisma.jobDiscoveryProfileUpdateInput = {};

  if (data.roleTargets !== undefined) fields.roleTargetsJson = toJson(data.roleTargets);
  if (data.locationTargets !== undefined) fields.locationTargetsJson = toJson(data.locationTargets);
  if (data.workModes !== undefined) fields.workModesJson = toJson(data.workModes);
  if (data.employmentTypes !== undefined) fields.employmentTypesJson = toJson(data.employmentTypes);
  if (data.experienceLevels !== undefined) fields.experienceLevelsJson = toJson(data.experienceLevels);
  if (data.includedKeywords !== undefined) fields.includedKeywordsJson = toJson(data.includedKeywords);
  if (data.excludedKeywords !== undefined) fields.excludedKeywordsJson = toJson(data.excludedKeywords);
  if (data.workAuthorization !== undefined) fields.workAuthorizationJson = toJson(data.workAuthorization);
  if (data.visaPreference !== undefined) fields.visaPreference = data.visaPreference;
  if (data.freshnessDays !== undefined) fields.freshnessDays = data.freshnessDays;
  if (data.minimumSuitabilityScore !== undefined) fields.minimumSuitabilityScore = data.minimumSuitabilityScore;
  if (data.dailyTarget !== undefined) fields.dailyTarget = data.dailyTarget;
  if (data.providerPreferences !== undefined) fields.providerPreferencesJson = toJson(data.providerPreferences);
  if (generated) fields.generatedFromContextAt = new Date();

  return fields;
}

export async function upsertDiscoveryProfile(
  userId: string,
  data: Partial<JobDiscoveryProfileData>,
  generated?: boolean,
) {
  const updates = buildProfileFields(data, generated);

  return prisma.jobDiscoveryProfile.upsert({
    where: { userId },
    create: {
      user: { connect: { id: userId } },
      roleTargetsJson: toJson(data.roleTargets ?? []),
      locationTargetsJson: toJson(data.locationTargets ?? []),
      workModesJson: toJson(data.workModes ?? []),
      employmentTypesJson: toJson(data.employmentTypes ?? []),
      experienceLevelsJson: toJson(data.experienceLevels ?? []),
      includedKeywordsJson: toJson(data.includedKeywords ?? []),
      excludedKeywordsJson: toJson(data.excludedKeywords ?? []),
      workAuthorizationJson: toJson(data.workAuthorization ?? {}),
      visaPreference: data.visaPreference ?? null,
      freshnessDays: data.freshnessDays ?? 14,
      minimumSuitabilityScore: data.minimumSuitabilityScore ?? 75,
      dailyTarget: data.dailyTarget ?? 20,
      providerPreferencesJson: toJson(data.providerPreferences ?? {}),
      generatedFromContextAt: generated ? new Date() : null,
    },
    update: updates,
  });
}
