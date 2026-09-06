import { prisma } from "@/server/db/prisma";
import { isAiConfigured } from "@/server/ai";

import { getDiscoveryProfileForUser } from "@/features/jobs/discovery/lib/get-discovery-profile";
import { extractRequirementsWithAi } from "../ai/opportunity-ai";
import { buildCareerEvidence } from "../evidence/build-career-evidence";
import { bestEvidenceStrength, mapEvidenceForRequirement } from "../evidence/map-job-evidence";
import { buildEvidenceFingerprint } from "../evidence/evidence-fingerprint";
import { evaluateJobEligibility } from "../eligibility/evaluate-job-eligibility";
import { analyzeJobGaps, countGaps } from "../gaps/analyze-job-gaps";
import { extractJobRequirementsDeterministic } from "../requirements/extract-job-requirements";
import { reconcileJobRequirements } from "../requirements/reconcile-job-requirements";
import { classifyApplicationEffort, effortScore } from "../scoring/application-effort";
import { calculateEvidenceCoverage, clampScore } from "../scoring/evidence-coverage";
import { calculateOpportunityScore } from "../scoring/opportunity-score";
import { applyPriorityGuardrails, bandFromPriorityScore, calculatePriorityScore } from "../scoring/priority-score";
import type { JobOpportunityView, JobRequirementInput, OpportunityWarning } from "../types";
import { parseEligibilityChecks, parseGaps, parseWarnings, toPrismaJson } from "./json-parsers";
import { normalizeToken } from "./hash";
import { buildOpportunityContextFingerprint } from "./opportunity-context-fingerprint";
import { OpportunityAccessError } from "./permissions";

function freshnessScore(postedAt: Date | null, now = new Date()): number {
  if (!postedAt) return 50;
  const days = Math.floor((now.getTime() - postedAt.getTime()) / 86_400_000);
  if (days <= 2) return 100;
  if (days <= 7) return 85;
  if (days <= 14) return 70;
  if (days <= 30) return 45;
  return 20;
}

function roleFitScore(title: string, roleTargets: string[]): number {
  const normalizedTitle = normalizeToken(title);
  if (roleTargets.length === 0) {
    if (normalizedTitle.includes("backend") || normalizedTitle.includes("engineer")) return 70;
    return 55;
  }
  for (const role of roleTargets) {
    const token = normalizeToken(role);
    if (!token) continue;
    if (normalizedTitle === token) return 100;
    if (normalizedTitle.includes(token) || token.includes(normalizedTitle)) return 88;
    const titleParts = new Set(normalizedTitle.split(" "));
    const overlap = token.split(" ").filter((part) => titleParts.has(part) && part.length > 2);
    if (overlap.length >= 2) return 76;
    if (overlap.length === 1) return 62;
  }
  return 42;
}

function mergeRequirements(base: JobRequirementInput[], extra: JobRequirementInput[]): JobRequirementInput[] {
  const merged = [...base];
  for (const item of extra) {
    const key = `${item.category}:${normalizeToken(item.normalizedName)}`;
    if (merged.some((existing) => `${existing.category}:${normalizeToken(existing.normalizedName)}` === key)) {
      continue;
    }
    merged.push(item);
  }
  return merged.slice(0, 24);
}

export async function analyzeJobOpportunity(
  userId: string,
  jobPostingId: string,
  options?: { force?: boolean },
): Promise<JobOpportunityView> {
  const job = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, userId },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      description: true,
      jobUrl: true,
      source: true,
    },
  });
  if (!job) {
    throw new OpportunityAccessError("NOT_FOUND", "Job not found.");
  }

  const [profile, evidence, discovered, existingAnalysis, activeApplications] = await Promise.all([
    getDiscoveryProfileForUser(userId),
    buildCareerEvidence(userId),
    prisma.discoveredJob.findFirst({
      where: { userId, jobPostingId: job.id },
      select: { postedAt: true, expiresAt: true, discoveryStatus: true },
    }),
    prisma.jobOpportunityAnalysis.findUnique({
      where: { jobPostingId: job.id },
    }),
    prisma.application.findMany({
      where: {
        userId,
        jobPostingId: job.id,
        status: { in: ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "ACCEPTED"] },
      },
      select: { id: true, status: true },
    }),
  ]);

  const roleTargets = (profile?.roleTargets ?? []).filter((item) => item.enabled).map((item) => item.title);
  const fingerprint = buildOpportunityContextFingerprint({
    title: job.title,
    company: job.company,
    description: job.description,
    location: job.location,
    jobUrl: job.jobUrl,
    roleTargets,
    workModes: profile?.workModes ?? [],
    evidenceSignal: evidence
      .map((item) => item.evidenceLabel)
      .sort()
      .slice(0, 40)
      .join(","),
  });

  if (!options?.force && existingAnalysis && existingAnalysis.contextFingerprint === fingerprint) {
    return mapAnalysisRow(existingAnalysis);
  }

  const deterministicRequirements = extractJobRequirementsDeterministic({
    title: job.title,
    description: job.description,
  });

  const warnings: OpportunityWarning[] = [];
  let analysisSource: "RULE_BASED" | "AI_ASSISTED" | "FALLBACK" = "RULE_BASED";
  let summary: string | null = null;
  let whyYouMatch: string[] = [];
  let requirements = deterministicRequirements;

  if (isAiConfigured()) {
    const ai = await extractRequirementsWithAi({
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      roleTargets,
      evidenceLabels: evidence.map((item) => item.evidenceLabel),
    });
    if (ai.ok && ai.requirements.length > 0) {
      requirements = mergeRequirements(deterministicRequirements, ai.requirements);
      summary = ai.summary;
      whyYouMatch = ai.whyYouMatch;
      warnings.push(...ai.warnings);
      analysisSource = "AI_ASSISTED";
    } else {
      analysisSource = "FALLBACK";
      warnings.push({
        code: "ai_unavailable",
        message: "Opportunity AI was unavailable. CareerOS used deterministic extraction only.",
      });
    }
  } else {
    analysisSource = "RULE_BASED";
  }

  const reconciled = await reconcileJobRequirements({
    userId,
    jobPostingId: job.id,
    requirements,
  });

  const mapped = reconciled.map((row) => {
    const matches = mapEvidenceForRequirement(row.input, evidence);
    return {
      ...row,
      matches,
      bestStrength: bestEvidenceStrength(matches),
    };
  });

  await prisma.jobEvidenceMatch.deleteMany({
    where: { jobRequirementId: { in: mapped.map((row) => row.id) } },
  });

  for (const row of mapped) {
    for (const match of row.matches) {
      await prisma.jobEvidenceMatch.create({
        data: {
          userId,
          jobRequirementId: row.id,
          evidenceType: match.evidenceType,
          evidenceSourceId: match.evidenceSourceId,
          evidenceLabel: match.evidenceLabel,
          evidenceExcerpt: match.evidenceExcerpt,
          matchStrength: match.matchStrength,
          reasoning: match.reasoning,
          fingerprint: buildEvidenceFingerprint(match),
        },
      });
    }
  }

  const coverage = calculateEvidenceCoverage(
    mapped.map((row) => ({ importance: row.input.importance, bestStrength: row.bestStrength })),
  );
  const skillRows = mapped.filter((row) => row.input.category === "SKILL");
  const skillFit = calculateEvidenceCoverage(
    (skillRows.length > 0 ? skillRows : mapped).map((row) => ({
      importance: row.input.importance,
      bestStrength: row.bestStrength,
    })),
  );
  const evidenceFit = clampScore(
    mapped.reduce((sum, row) => {
      const multiplier =
        row.bestStrength === "DIRECT"
          ? 100
          : row.bestStrength === "STRONG"
            ? 88
            : row.bestStrength === "PARTIAL"
              ? 60
              : row.bestStrength === "TRANSFERABLE"
                ? 40
                : 8;
      return sum + multiplier;
    }, 0) / Math.max(1, mapped.length),
  );

  const experienceReq = mapped.find((row) => row.input.category === "EXPERIENCE");
  const experienceFit = experienceReq
    ? experienceReq.bestStrength === "NONE"
      ? 55
      : experienceReq.bestStrength === "TRANSFERABLE"
        ? 62
        : 80
    : 70;

  const locationTargets = (profile?.locationTargets ?? [])
    .filter((item) => item.enabled)
    .flatMap((item) => [item.country, ...item.cities]);
  const locationFit = job.location
    ? locationTargets.some((target) => job.location?.toLowerCase().includes(target.toLowerCase()))
      ? 90
      : 65
    : 55;

  const authorizationMentioned = mapped.some((row) => row.input.category === "AUTHORIZATION");
  const authorizationFit = authorizationMentioned ? 70 : 75;

  const requiresCoverLetter = mapped.some((row) => normalizeToken(row.input.normalizedName).includes("cover letter"));
  const requiresPortfolio = mapped.some((row) => normalizeToken(row.input.normalizedName).includes("portfolio"));
  const applyByEmail = /mailto:|apply by email|send your (cv|resume) to/i.test(job.description);
  const effort = classifyApplicationEffort({
    requiresCoverLetter,
    requiresPortfolio,
    requiresAssessment: /assessment|take-home|coding challenge/i.test(job.description),
    applyByEmail,
    sourceHint: job.source,
  });

  const listingExpired = Boolean(discovered?.expiresAt && discovered.expiresAt.getTime() < Date.now());
  const alreadyApplied = activeApplications.length > 0;
  const eligibility = evaluateJobEligibility({
    title: job.title,
    location: job.location,
    description: job.description,
    requirements: mapped.map((row) => row.input),
    profileWorkModes: profile?.workModes ?? [],
    profileLocations: locationTargets,
  });

  if (alreadyApplied) {
    warnings.push({
      code: "already_applied",
      message: "Already applied to this exact listing. This is a duplicate-application state, not an eligibility fact.",
    });
  }
  if (listingExpired) {
    warnings.push({
      code: "listing_expired",
      message: "This listing is known expired or closed in CareerOS. That is a listing state, not an eligibility fact.",
    });
  }

  const gaps = analyzeJobGaps(mapped.map((row) => ({ ...row.input, bestStrength: row.bestStrength })));
  const gapCounts = countGaps(gaps);

  const components = {
    roleFit: roleFitScore(job.title, roleTargets),
    skillFit,
    evidenceFit,
    experienceFit,
    locationFit,
    authorizationFit,
    freshnessScore: freshnessScore(discovered?.postedAt ?? null),
    applicationEffortScore: effortScore(effort),
  };
  const opportunityScore = calculateOpportunityScore(components);
  const priorityScore = calculatePriorityScore({
    opportunityScore,
    freshnessScore: components.freshnessScore,
    applicationEffortScore: components.applicationEffortScore,
  });
  const guarded = applyPriorityGuardrails({
    baseBand: bandFromPriorityScore(priorityScore),
    eligibilityStatus: eligibility.status,
    hasConfirmedBlocker: gapCounts.criticalGapCount > 0,
    alreadyApplied,
    listingExpired,
  });

  if (whyYouMatch.length === 0) {
    if (components.roleFit >= 75) whyYouMatch.push("Role title aligns with stored target roles.");
    const direct = mapped.filter((row) => row.bestStrength === "DIRECT").slice(0, 3);
    for (const row of direct) {
      whyYouMatch.push(`${row.input.normalizedName} is directly evidenced.`);
    }
    if (gapCounts.criticalGapCount === 0) whyYouMatch.push("No confirmed critical blocker is stored.");
  }

  const status = analysisSource === "FALLBACK" ? "PARTIAL" : "COMPLETED";

  const saved = await prisma.jobOpportunityAnalysis.upsert({
    where: { jobPostingId: job.id },
    create: {
      userId,
      jobPostingId: job.id,
      status,
      ...components,
      opportunityScore,
      priorityScore,
      priorityBand: guarded.band,
      recommendation: guarded.recommendation,
      eligibilityStatus: eligibility.status,
      applicationEffort: effort,
      evidenceCoverage: coverage,
      ...gapCounts,
      gapsJson: toPrismaJson(gaps),
      eligibilityChecksJson: toPrismaJson(eligibility.checks),
      warningsJson: toPrismaJson(warnings),
      summary,
      contextFingerprint: fingerprint,
      analysisSource,
    },
    update: {
      status,
      ...components,
      opportunityScore,
      priorityScore,
      priorityBand: guarded.band,
      recommendation: guarded.recommendation,
      eligibilityStatus: eligibility.status,
      applicationEffort: effort,
      evidenceCoverage: coverage,
      ...gapCounts,
      gapsJson: toPrismaJson(gaps),
      eligibilityChecksJson: toPrismaJson(eligibility.checks),
      warningsJson: toPrismaJson(warnings),
      summary,
      contextFingerprint: fingerprint,
      analysisSource,
    },
  });

  return {
    ...mapAnalysisRow(saved),
    whyYouMatch,
  };
}

function mapAnalysisRow(row: {
  id: string;
  jobPostingId: string;
  status: JobOpportunityView["status"];
  analysisSource: JobOpportunityView["analysisSource"];
  roleFit: number;
  skillFit: number;
  experienceFit: number;
  evidenceFit: number;
  locationFit: number;
  authorizationFit: number;
  freshnessScore: number;
  applicationEffortScore: number;
  opportunityScore: number;
  priorityScore: number;
  priorityBand: JobOpportunityView["priorityBand"];
  recommendation: JobOpportunityView["recommendation"];
  eligibilityStatus: JobOpportunityView["eligibilityStatus"];
  applicationEffort: JobOpportunityView["applicationEffort"];
  evidenceCoverage: number;
  criticalGapCount: number;
  importantGapCount: number;
  minorGapCount: number;
  optionalGapCount: number;
  gapsJson: unknown;
  eligibilityChecksJson: unknown;
  warningsJson: unknown;
  summary: string | null;
  contextFingerprint: string;
  updatedAt: Date;
}): JobOpportunityView {
  return {
    id: row.id,
    jobPostingId: row.jobPostingId,
    status: row.status,
    analysisSource: row.analysisSource,
    components: {
      roleFit: row.roleFit,
      skillFit: row.skillFit,
      evidenceFit: row.evidenceFit,
      experienceFit: row.experienceFit,
      locationFit: row.locationFit,
      authorizationFit: row.authorizationFit,
      freshnessScore: row.freshnessScore,
      applicationEffortScore: row.applicationEffortScore,
    },
    opportunityScore: row.opportunityScore,
    priorityScore: row.priorityScore,
    priorityBand: row.priorityBand,
    recommendation: row.recommendation,
    eligibilityStatus: row.eligibilityStatus,
    applicationEffort: row.applicationEffort,
    evidenceCoverage: row.evidenceCoverage,
    criticalGapCount: row.criticalGapCount,
    importantGapCount: row.importantGapCount,
    minorGapCount: row.minorGapCount,
    optionalGapCount: row.optionalGapCount,
    gaps: parseGaps(row.gapsJson),
    eligibilityChecks: parseEligibilityChecks(row.eligibilityChecksJson),
    warnings: parseWarnings(row.warningsJson),
    summary: row.summary,
    whyYouMatch: row.summary ? [row.summary] : [],
    contextFingerprint: row.contextFingerprint,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getOpportunityAnalysisForUser(userId: string, jobPostingId: string) {
  const row = await prisma.jobOpportunityAnalysis.findFirst({
    where: { userId, jobPostingId },
  });
  return row ? mapAnalysisRow(row) : null;
}
