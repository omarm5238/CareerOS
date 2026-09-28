import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getLatestResumeAnalysisForUser } from "@/features/resume/server";

import { DISCOVERY_COOLDOWN_MS, AI_DEEP_RANK_LIMIT } from "../constants";
import type {
  ProviderJobResult,
  DiscoveryQuerySnapshot, DiscoveryRunResult, JobDiscoveryProfileData,
} from "../types";
import { executeProviderSearches } from "../providers/execute-search";
import { getAllProviders, getEnabledProviders } from "../providers/registry";
import { titleVariants } from "../providers/query-planner";
import { stripHtml, normalizeTitle, normalizeCompany, normalizeLocation } from "../normalization/normalize-text";
import { fingerprintJob } from "../normalization/fingerprint-job";
import { calculateDeterministicScore } from "../scoring/deterministic-score";
import { rankDiscoveredJobsBatch } from "../ai/rank-discovered-jobs";
import { buildScoreContextFingerprint } from "../ai/context-fingerprint";
import { getDiscoveryProfileForUser } from "./get-discovery-profile";
import {
  interpretSearchProfile,
  prepareDiscoveryCandidates,
  queryCountries,
  queryTitles,
  type DiscoveryQualityJob,
  type FilterStats,
} from "../quality/search-quality";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toProviderQualityJob(job: ProviderJobResult, index: number): DiscoveryQualityJob {
  return {
    id: `${job.provider}:${job.externalId ?? index}`,
    title: job.title,
    company: job.company,
    location: job.location,
    countryCode: job.countryCode,
    workMode: job.workMode,
    employmentType: job.employmentType,
    description: stripHtml(job.description),
    postedAt: job.postedAt,
    expiresAt: job.expiresAt,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    provider: job.provider,
    externalId: job.externalId,
  };
}

function coverageCounts(jobs: DiscoveryQualityJob[]): Record<string, number> {
  const counts: Record<string, number> = { TR: 0, DE: 0, NL: 0, REMOTE: 0, OTHER: 0 };
  for (const job of jobs) {
    const country = (job.countryCode ?? "").toUpperCase();
    if (country === "TR" || country === "DE" || country === "NL") counts[country]++;
    else if (job.workMode === "REMOTE") counts.REMOTE++;
    else counts.OTHER++;
  }
  return counts;
}

function discoveryBand(band: string): "STRONG" | "POSSIBLE" | "LOW" | null {
  if (band === "INELIGIBLE") return null;
  if (band === "STRONG" || band === "POSSIBLE" || band === "LOW") return band;
  return "LOW";
}

export async function runJobDiscovery(userId: string, options?: { force?: boolean }): Promise<DiscoveryRunResult> {
  const start = Date.now();

  // Load profile
  const profileRow = await getDiscoveryProfileForUser(userId);
  if (!profileRow) {
    throw new Error("No search profile found. Generate or create one first.");
  }

  const profile: JobDiscoveryProfileData = {
    roleTargets: profileRow.roleTargets,
    locationTargets: profileRow.locationTargets,
    workModes: profileRow.workModes,
    employmentTypes: profileRow.employmentTypes,
    experienceLevels: profileRow.experienceLevels,
    includedKeywords: profileRow.includedKeywords,
    excludedKeywords: profileRow.excludedKeywords,
    workAuthorization: profileRow.workAuthorization,
    visaPreference: profileRow.visaPreference,
    freshnessDays: profileRow.freshnessDays,
    minimumSuitabilityScore: profileRow.minimumSuitabilityScore,
    dailyTarget: profileRow.dailyTarget,
    providerPreferences: profileRow.providerPreferences,
    searchIntent: profileRow.searchIntent,
  };

  const intent = interpretSearchProfile(profile);

  const enabledTargets = profile.roleTargets.filter(t => t.enabled);
  if (enabledTargets.length === 0) {
    throw new Error("No enabled role targets in search profile.");
  }

  // Cooldown check
  const recentRun = await prisma.jobDiscoveryRun.findFirst({
    where: { userId, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
  if (recentRun) {
    const elapsed = Date.now() - recentRun.startedAt.getTime();
    if (elapsed < 5 * 60 * 1000) {
      throw new Error("A discovery run is already in progress.");
    }
    // Stale running run - mark failed
    await prisma.jobDiscoveryRun.update({
      where: { id: recentRun.id },
      data: { status: "FAILED", completedAt: new Date() },
    });
  }

  const recentCompleted = await prisma.jobDiscoveryRun.findFirst({
    where: { userId, status: { in: ["COMPLETED", "PARTIAL"] } },
    orderBy: { startedAt: "desc" },
  });
  if (!options?.force && recentCompleted) {
    const elapsed = Date.now() - recentCompleted.startedAt.getTime();
    if (elapsed < DISCOVERY_COOLDOWN_MS) {
      throw new Error("Please wait before running discovery again.");
    }
  }

  const queryVariants = titleVariants(intent.preferredTitles.length > 0 ? intent.preferredTitles : queryTitles(intent));
  const enabledProviders = getEnabledProviders(profile.providerPreferences);
  const countries = queryCountries(intent);
  const remoteWanted = intent.locationMode === "REMOTE_ONLY"
    || intent.locationMode === "CURRENT_COUNTRY_PLUS_REMOTE"
    || intent.locationMode === "SELECTED_COUNTRIES_PLUS_REMOTE";

  const querySnapshot: DiscoveryQuerySnapshot = {
    roleTargets: enabledTargets.map(t => t.title),
    locations: countries.length > 0 ? countries : [intent.currentCountryCode ?? ""].filter(Boolean),
    workModes: profile.workModes,
    freshnessDays: intent.freshnessDays,
    minimumSuitabilityScore: profile.minimumSuitabilityScore,
    enabledProviders: enabledProviders.map(p => p.provider),
    queryVariants,
  };

  const run = await prisma.jobDiscoveryRun.create({
    data: {
      userId,
      profileId: profileRow.id,
      status: "RUNNING",
      querySnapshotJson: toJson(querySnapshot),
    },
  });

  const searched = await executeProviderSearches({
    providers: getAllProviders(),
    enabled: enabledProviders,
    intent,
    remoteWanted,
  });
  const allResults = searched.results;
  const providerStats = searched.stats;
  const providerErrors = searched.errors;
  const anySuccess = searched.anySuccess;

  const emptyStats: FilterStats = {
    fetched: 0, normalized: 0, duplicatesRemoved: 0, roleFiltered: 0, seniorityFiltered: 0,
    stackFiltered: 0, employmentFiltered: 0, geoFiltered: 0, freshnessFiltered: 0, trustFiltered: 0,
    kept: 0, locationIncomplete: intent.locationMode !== "REMOTE_ONLY" && intent.locationMode !== "SELECTED_COUNTRIES" && intent.locationMode !== "SELECTED_COUNTRIES_PLUS_REMOTE" && !intent.currentCountryCode,
  };

  if (!anySuccess) {
    await prisma.jobDiscoveryRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        providerStatsJson: toJson(providerStats),
        providerErrorsJson: toJson(providerErrors),
        rawFoundCount: 0,
        querySnapshotJson: toJson({ ...querySnapshot, filterStats: emptyStats }),
      },
    });
    return {
      runId: run.id,
      status: "FAILED",
      rawFoundCount: 0, normalizedCount: 0, duplicateCount: 0,
      hardRejectedCount: 0, scoredCount: 0, strongMatchCount: 0,
      providerStats, providerErrors, durationMs: Date.now() - start,
      filterStats: emptyStats,
    };
  }

  const prepared = prepareDiscoveryCandidates(
    allResults.map((job, index) => toProviderQualityJob(job, index)),
    intent,
  );
  const keptIds = new Set(prepared.kept.map((job) => job.id));
  const candidates = allResults.filter((job, index) => keptIds.has(toProviderQualityJob(job, index).id));
  const rawFoundCount = allResults.length;
  let duplicateCount = prepared.stats.duplicatesRemoved;
  const hardRejectedCount = rawFoundCount - prepared.stats.normalized + (
    prepared.stats.roleFiltered + prepared.stats.seniorityFiltered + prepared.stats.stackFiltered
    + prepared.stats.employmentFiltered + prepared.stats.geoFiltered + prepared.stats.freshnessFiltered
    + prepared.stats.trustFiltered
  );

  // Load resume context for scoring
  const resumeAnalysis = await getLatestResumeAnalysisForUser(userId);
  const userSkills: string[] = [];
  const userEvidenceSkills: string[] = [];
  if (resumeAnalysis) {
    userSkills.push(...resumeAnalysis.detectedSkills);
    userEvidenceSkills.push(...resumeAnalysis.detectedSkills);
  }

  // Upsert discovered jobs and score
  const upsertedIds: string[] = [];
  let scoredCount = 0;
  let strongMatchCount = 0;

  for (const job of candidates) {
    const normTitle = normalizeTitle(job.title);
    const normCompany = normalizeCompany(job.company);
    const normLocation = normalizeLocation(job.location);
    const safeDescription = stripHtml(job.description);
    const fp = fingerprintJob(job.company, job.title, job.countryCode, job.location);

    // Deterministic score
    const scoreResult = calculateDeterministicScore({
      jobTitle: job.title,
      jobDescription: safeDescription,
      jobLocation: job.location,
      jobCountryCode: job.countryCode,
      jobWorkMode: job.workMode,
      jobEmploymentType: job.employmentType,
      jobPostedAt: job.postedAt,
      roleTargets: profile.roleTargets,
      locationTargets: profile.locationTargets,
      userWorkModes: profile.workModes,
      userEmploymentTypes: profile.employmentTypes,
      userExperienceLevel: resumeAnalysis?.experienceLevel ?? null,
      userSkills,
      userEvidenceSkills,
      freshnessDays: intent.freshnessDays,
      searchTargetCountryCodes: [...new Set([intent.currentCountryCode, ...intent.selectedCountryCodes].filter((code): code is string => Boolean(code)))],
      profileCountryCode: intent.currentCountryCode,
    });

    const ctxFp = buildScoreContextFingerprint({
      normalizedTitle: normTitle,
      normalizedCompany: normCompany,
      roleTargets: enabledTargets.map(t => t.title),
      resumeAnalysisId: resumeAnalysis?.analysisId ?? null,
      skillsContextKey: "m30b-canonical",
    });

    // Upsert job
    const existing = await prisma.discoveredJob.findUnique({
      where: { userId_canonicalFingerprint: { userId, canonicalFingerprint: fp } },
      select: { id: true, timesSeen: true, scoreContextFingerprint: true, aiScore: true, analysisSource: true },
    });

    let jobId: string;

    if (existing) {
      // Update seen count, don't re-score if context unchanged
      const shouldRescore = existing.scoreContextFingerprint !== ctxFp;
      const updateData: Record<string, unknown> = {
        lastSeenAt: new Date(),
        timesSeen: existing.timesSeen + 1,
        lastDiscoveryRunId: run.id,
      };
      if (shouldRescore) {
        updateData.deterministicScore = scoreResult.canonical.score;
        updateData.finalScore = scoreResult.canonical.score;
        updateData.scoreBand = discoveryBand(scoreResult.scoreBand);
        updateData.matchedSkillsJson = toJson(scoreResult.matchedSkills);
        updateData.missingSkillsJson = toJson(scoreResult.missingSkills);
        updateData.hardBlockersJson = toJson(scoreResult.hardBlockers);
        updateData.softBlockersJson = toJson(scoreResult.softBlockers);
        updateData.evidenceJson = toJson(scoreResult.evidence);
        updateData.analysisSource = "RULE_BASED";
        updateData.scoreContextFingerprint = ctxFp;
        updateData.discoveryStatus = scoreResult.canonical.eligibility === "INELIGIBLE" ? "FILTERED" : "CANDIDATE";
      }
      await prisma.discoveredJob.update({
        where: { id: existing.id },
        data: updateData as Prisma.discoveredJobUpdateInput,
      });
      jobId = existing.id;
      duplicateCount++;
    } else {
      const created = await prisma.discoveredJob.create({
        data: {
          userId,
          title: job.title,
          normalizedTitle: normTitle,
          company: job.company,
          normalizedCompany: normCompany,
          location: job.location,
          countryCode: job.countryCode,
          workMode: job.workMode,
          employmentType: job.employmentType,
          description: safeDescription.slice(0, 10000),
          salaryText: job.salaryText,
          postedAt: job.postedAt ? new Date(job.postedAt) : null,
          expiresAt: job.expiresAt ? new Date(job.expiresAt) : null,
          canonicalFingerprint: fp,
          lastDiscoveryRunId: run.id,
          deterministicScore: scoreResult.canonical.score,
          finalScore: scoreResult.canonical.score,
          scoreBand: discoveryBand(scoreResult.scoreBand),
          matchedSkillsJson: toJson(scoreResult.matchedSkills),
          missingSkillsJson: toJson(scoreResult.missingSkills),
          hardBlockersJson: toJson(scoreResult.hardBlockers),
          softBlockersJson: toJson(scoreResult.softBlockers),
          evidenceJson: toJson(scoreResult.evidence),
          warningsJson: toJson([]),
          analysisSource: "RULE_BASED",
          scoreContextFingerprint: ctxFp,
        },
      });
      jobId = created.id;
    }

    upsertedIds.push(jobId);

    // Upsert source
    await prisma.discoveredJobSource.upsert({
      where: {
        discoveredJobId_provider_externalId: {
          discoveredJobId: jobId,
          provider: job.provider,
          externalId: job.externalId ?? "",
        },
      },
      create: {
        discoveredJobId: jobId,
        provider: job.provider,
        externalId: job.externalId,
        sourceUrl: job.sourceUrl,
        applyUrl: job.applyUrl,
      },
      update: {
        lastSeenAt: new Date(),
        sourceUrl: job.sourceUrl,
        applyUrl: job.applyUrl,
      },
    });

    scoredCount++;
    if (scoreResult.breakdown.total >= profile.minimumSuitabilityScore) {
      strongMatchCount++;
    }
  }

  if (upsertedIds.length === 0) {
    await prisma.discoveredJob.updateMany({
      where: { userId, discoveryStatus: "CANDIDATE", dismissedAt: null },
      data: { discoveryStatus: "STALE" },
    });
  } else {
    await prisma.discoveredJob.updateMany({
      where: { userId, discoveryStatus: "CANDIDATE", dismissedAt: null, id: { notIn: upsertedIds } },
      data: { discoveryStatus: "STALE" },
    });
  }

  const normalizedCount = candidates.length;

  // AI deep ranking for top candidates
  const topCandidates = await prisma.discoveredJob.findMany({
    where: {
      id: { in: upsertedIds },
      discoveryStatus: "CANDIDATE",
      deterministicScore: { not: null },
    },
    orderBy: { deterministicScore: "desc" },
    take: AI_DEEP_RANK_LIMIT,
    select: {
      id: true, title: true, company: true, description: true,
      matchedSkillsJson: true, missingSkillsJson: true,
      scoreContextFingerprint: true, aiScore: true, hardBlockersJson: true,
    },
  });

  const needsAiRank = topCandidates.filter((candidate) => {
    if (candidate.aiScore !== null) return false;
    return !Array.isArray(candidate.hardBlockersJson) || candidate.hardBlockersJson.length === 0;
  });

  if (needsAiRank.length > 0 && resumeAnalysis) {
    const aiResult = await rankDiscoveredJobsBatch(
      needsAiRank.map(c => ({
        id: c.id,
        title: c.title,
        company: c.company,
        description: c.description.slice(0, 1500),
        matchedSkills: Array.isArray(c.matchedSkillsJson) ? c.matchedSkillsJson as string[] : [],
        missingSkills: Array.isArray(c.missingSkillsJson) ? c.missingSkillsJson as string[] : [],
      })),
      {
        role: resumeAnalysis.role,
        skills: userSkills.slice(0, 15),
        experienceLevel: resumeAnalysis.experienceLevel,
        strengths: Array.isArray(resumeAnalysis.strengths)
          ? (resumeAnalysis.strengths as string[]).slice(0, 5) : [],
      },
    );

    if (aiResult.ok) {
      for (const ranking of aiResult.rankings) {
        const candidate = needsAiRank.find(c => c.id === ranking.candidateId);
        if (!candidate) continue;

        await prisma.discoveredJob.update({
          where: { id: candidate.id },
          data: {
            matchSummary: ranking.matchSummary || null,
            aiModel: process.env.OPENAI_DISCOVERY_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || null,
          },
        });
      }
    }
  }

  // Recount strong matches accurately
  const strongCount = await prisma.discoveredJob.count({
    where: {
      userId,
      discoveryStatus: "CANDIDATE",
      finalScore: { gte: profile.minimumSuitabilityScore },
      dismissedAt: null,
    },
  });

  // Update run
  const status = providerErrors.length > 0 && anySuccess ? "PARTIAL" : "COMPLETED";
  await prisma.jobDiscoveryRun.update({
    where: { id: run.id },
    data: {
      status,
      completedAt: new Date(),
      providerStatsJson: toJson(providerStats),
      providerErrorsJson: toJson(providerErrors),
      rawFoundCount: rawFoundCount,
      normalizedCount,
      duplicateCount,
      hardRejectedCount,
      scoredCount,
      strongMatchCount: strongCount,
      querySnapshotJson: toJson({
        ...querySnapshot,
        filterStats: prepared.stats,
        providerStats,
        coverage: {
          fetched: coverageCounts(allResults.map((job, index) => toProviderQualityJob(job, index))),
          kept: coverageCounts(prepared.kept),
        },
      }),
    },
  });

  return {
    runId: run.id,
    status,
    rawFoundCount,
    normalizedCount,
    duplicateCount,
    hardRejectedCount,
    scoredCount,
    strongMatchCount: strongCount,
    providerStats,
    providerErrors,
    durationMs: Date.now() - start,
    filterStats: prepared.stats,
  };
}
