import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getLatestResumeAnalysisForUser } from "@/features/resume/server";

import { DISCOVERY_COOLDOWN_MS, AI_DEEP_RANK_LIMIT, MAX_QUERY_VARIANTS } from "../constants";
import type {
  DiscoveryProviderName, ProviderJobResult, ProviderRunStats, ProviderError,
  DiscoveryQuerySnapshot, DiscoveryRunResult, JobDiscoveryProfileData,
} from "../types";
import { getEnabledProviders } from "../providers/registry";
import { stripHtml, normalizeTitle, normalizeCompany, normalizeLocation } from "../normalization/normalize-text";
import { canonicalizeUrl } from "../normalization/canonicalize-url";
import { fingerprintJob } from "../normalization/fingerprint-job";
import { calculateDeterministicScore } from "../scoring/deterministic-score";
import { rankDiscoveredJobsBatch } from "../ai/rank-discovered-jobs";
import { buildScoreContextFingerprint } from "../ai/context-fingerprint";
import { getDiscoveryProfileForUser, parseDiscoveryProfileData } from "./get-discovery-profile";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function buildQueryVariants(profile: JobDiscoveryProfileData): string[] {
  const variants = new Set<string>();
  for (const target of profile.roleTargets) {
    if (!target.enabled) continue;
    variants.add(target.title.toLowerCase());
    for (const alias of target.aliases) {
      variants.add(alias.toLowerCase());
      if (variants.size >= MAX_QUERY_VARIANTS) break;
    }
    if (variants.size >= MAX_QUERY_VARIANTS) break;
  }
  return [...variants];
}

function isHardRejected(
  job: ProviderJobResult,
  profile: JobDiscoveryProfileData,
): string | null {
  // Malformed
  if (!job.title.trim() || !job.company.trim()) return "malformed";
  if (!job.description || job.description.trim().length < 20) return "empty_description";

  // Freshness
  if (job.postedAt && profile.freshnessDays > 0) {
    const posted = new Date(job.postedAt);
    if (!isNaN(posted.getTime())) {
      const daysSincePost = (Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePost > profile.freshnessDays * 2) return "too_old";
    }
  }

  // Excluded keywords
  if (profile.excludedKeywords.length > 0) {
    const text = `${job.title} ${job.description}`.toLowerCase();
    for (const kw of profile.excludedKeywords) {
      if (text.includes(kw.toLowerCase())) return `excluded_keyword:${kw}`;
    }
  }

  return null;
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
  };

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

  // Create run record
  const queryVariants = buildQueryVariants(profile);
  const enabledProviders = getEnabledProviders(profile.providerPreferences);

  const querySnapshot: DiscoveryQuerySnapshot = {
    roleTargets: enabledTargets.map(t => t.title),
    locations: profile.locationTargets.filter(l => l.enabled).map(l => l.country),
    workModes: profile.workModes,
    freshnessDays: profile.freshnessDays,
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

  const allResults: ProviderJobResult[] = [];
  const providerStats: ProviderRunStats[] = [];
  const providerErrors: ProviderError[] = [];
  let anySuccess = false;

  // Fetch from providers
  for (const provider of enabledProviders) {
    const providerStart = Date.now();
    try {
      const results = await provider.search({ keywords: queryVariants });
      const durationMs = Date.now() - providerStart;

      allResults.push(...results);
      providerStats.push({
        provider: provider.provider,
        configured: true,
        requestsMade: 1,
        rawResults: results.length,
        normalizedResults: results.length,
        durationMs,
        status: "success",
      });
      anySuccess = true;
    } catch (err) {
      const durationMs = Date.now() - providerStart;
      const message = err instanceof Error ? err.message : "Unknown error";
      providerErrors.push({
        provider: provider.provider,
        category: message.includes("timeout") || message.includes("abort") ? "TIMEOUT" : "UNKNOWN",
        message: message.slice(0, 200),
      });
      providerStats.push({
        provider: provider.provider,
        configured: true,
        requestsMade: 1,
        rawResults: 0,
        normalizedResults: 0,
        durationMs,
        status: "failed",
      });
    }
  }

  if (!anySuccess) {
    await prisma.jobDiscoveryRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        providerStatsJson: toJson(providerStats),
        providerErrorsJson: toJson(providerErrors),
        rawFoundCount: 0,
      },
    });
    return {
      runId: run.id,
      status: "FAILED",
      rawFoundCount: 0, normalizedCount: 0, duplicateCount: 0,
      hardRejectedCount: 0, scoredCount: 0, strongMatchCount: 0,
      providerStats, providerErrors, durationMs: Date.now() - start,
    };
  }

  // Normalize & deduplicate
  const rawFoundCount = allResults.length;
  let duplicateCount = 0;
  let hardRejectedCount = 0;

  // Level 1 dedup: provider + externalId
  const seen = new Map<string, ProviderJobResult>();
  const dedupResults: ProviderJobResult[] = [];

  for (const job of allResults) {
    const key = `${job.provider}:${job.externalId ?? canonicalizeUrl(job.sourceUrl)}`;
    if (seen.has(key)) {
      duplicateCount++;
      continue;
    }
    seen.set(key, job);
    dedupResults.push(job);
  }

  // Level 2 dedup: canonical URL
  const urlSeen = new Set<string>();
  const urlDedupResults: ProviderJobResult[] = [];
  for (const job of dedupResults) {
    const canonUrl = canonicalizeUrl(job.sourceUrl);
    if (urlSeen.has(canonUrl)) {
      duplicateCount++;
      continue;
    }
    urlSeen.add(canonUrl);
    urlDedupResults.push(job);
  }

  // Hard filter
  const candidates: ProviderJobResult[] = [];
  for (const job of urlDedupResults) {
    const rejectReason = isHardRejected(job, profile);
    if (rejectReason) {
      hardRejectedCount++;
      continue;
    }
    candidates.push(job);
  }

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
      freshnessDays: profile.freshnessDays,
    });

    const ctxFp = buildScoreContextFingerprint({
      normalizedTitle: normTitle,
      normalizedCompany: normCompany,
      roleTargets: enabledTargets.map(t => t.title),
      resumeAnalysisId: resumeAnalysis?.analysisId ?? null,
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
        updateData.deterministicScore = scoreResult.breakdown.total;
        updateData.finalScore = scoreResult.breakdown.total;
        updateData.scoreBand = scoreResult.scoreBand;
        updateData.matchedSkillsJson = toJson(scoreResult.matchedSkills);
        updateData.missingSkillsJson = toJson(scoreResult.missingSkills);
        updateData.hardBlockersJson = toJson(scoreResult.hardBlockers);
        updateData.softBlockersJson = toJson(scoreResult.softBlockers);
        updateData.evidenceJson = toJson(scoreResult.evidence);
        updateData.analysisSource = "RULE_BASED";
        updateData.scoreContextFingerprint = ctxFp;
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
          deterministicScore: scoreResult.breakdown.total,
          finalScore: scoreResult.breakdown.total,
          scoreBand: scoreResult.scoreBand as "EXCELLENT" | "STRONG" | "POSSIBLE" | "LOW",
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
      scoreContextFingerprint: true, aiScore: true,
    },
  });

  // Only AI rank candidates that don't already have an AI score with matching context
  const needsAiRank = topCandidates.filter(c => c.aiScore === null);

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

        const existingDetScore = await prisma.discoveredJob.findUnique({
          where: { id: candidate.id },
          select: { deterministicScore: true },
        });

        const detScore = existingDetScore?.deterministicScore ?? 0;
        const finalScore = Math.round(detScore * 0.70 + ranking.aiSuitability * 0.30);

        const band = finalScore >= 85 ? "EXCELLENT" : finalScore >= 75 ? "STRONG" : finalScore >= 65 ? "POSSIBLE" : "LOW";

        await prisma.discoveredJob.update({
          where: { id: candidate.id },
          data: {
            aiScore: ranking.aiSuitability,
            finalScore,
            scoreBand: band,
            matchSummary: ranking.matchSummary || null,
            matchedSkillsJson: toJson(
              ranking.strongEvidence.length > 0 ? ranking.strongEvidence : [],
            ),
            missingSkillsJson: toJson(ranking.missingSkills),
            softBlockersJson: toJson(ranking.softBlockers),
            hardBlockersJson: toJson(ranking.hardBlockers),
            warningsJson: toJson(ranking.warnings),
            analysisSource: "AI_ENHANCED",
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
  };
}
