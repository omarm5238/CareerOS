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
import { calculateEvidenceCoverage } from "../scoring/evidence-coverage";
import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { evaluateCanonicalMatch } from "@/features/jobs/matching/canonical-match";
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
    evidenceSignal: `${evidence
      .map((item) => item.evidenceLabel)
      .sort()
      .slice(0, 40)
      .join(",")}|m30b`,
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
  const locationTargets = (profile?.locationTargets ?? [])
    .filter((item) => item.enabled)
    .flatMap((item) => [item.country, ...item.cities]);

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

  const resume = await getLatestResumeAnalysisForUser(userId);
  const skillLabels = evidence.filter((item) => item.evidenceType === "SKILL").map((item) => item.evidenceLabel);
  const match = evaluateCanonicalMatch(
    {
      title: job.title,
      description: job.description,
      location: job.location,
    },
    {
      roleTargets,
      experienceLevel: resume?.experienceLevel ?? null,
      skills: skillLabels,
      evidenceSkills: skillLabels,
      countryCode: profile?.locationTargets.find((target) => target.enabled)?.countryCode ?? null,
      countryNames: (profile?.locationTargets ?? [])
        .filter((target) => target.enabled)
        .flatMap((target) => [target.country, ...target.cities]),
      workModes: profile?.workModes ?? [],
    },
  );
  const eligibilityStatus = match.eligibility === "ELIGIBLE"
    ? "ELIGIBLE"
    : match.eligibility === "REVIEW_REQUIRED"
      ? "REVIEW_REQUIRED"
      : "INELIGIBLE";
  const opportunityScore = match.score ?? 0;
  const priorityBand = match.band === "INELIGIBLE"
    ? "SKIP"
    : match.eligibility === "REVIEW_REQUIRED"
      ? "REVIEW_FIRST"
      : match.band === "STRONG"
        ? "HIGH_PRIORITY"
        : match.band === "POSSIBLE"
          ? "GOOD_OPPORTUNITY"
          : "LOW_PRIORITY";
  const recommendation = priorityBand === "SKIP"
    ? "SKIP"
    : priorityBand === "HIGH_PRIORITY"
      ? "APPLY"
      : priorityBand === "GOOD_OPPORTUNITY"
        ? "APPLY_WITH_CAUTION"
        : "REVIEW_FIRST";
  const components = {
    roleFit: match.components.roleAlignment,
    skillFit: match.components.stackMatch,
    evidenceFit: match.components.evidenceStrength,
    experienceFit: match.components.experienceAlignment,
    locationFit: match.components.locationFit,
    authorizationFit: match.components.dataConfidence,
    freshnessScore: freshnessScore(discovered?.postedAt ?? null),
    applicationEffortScore: effortScore(effort),
  };
  const priorityScore = opportunityScore;
  const canonicalChecks = match.blockingReasons.map((reason) => ({
    key: reason === "LOCATION_INELIGIBLE" || reason === "UNKNOWN_LOCATION_POLICY" ? "LOCATION" : reason === "SENIORITY_MISMATCH" || reason === "UNKNOWN_SENIORITY" || reason === "EXPERIENCE_MISMATCH" ? "SENIORITY" : "EMPLOYMENT_RESTRICTION",
    status: eligibilityStatus,
    reason,
    evidence: null,
    requiresUserConfirmation: eligibilityStatus === "REVIEW_REQUIRED",
  }));

  if (match.eligibility === "INELIGIBLE") {
    summary = match.explanation.join(". ");
    whyYouMatch = [];
  } else if (!summary) {
    summary = match.explanation.join(". ");
    whyYouMatch = match.explanation;
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
      priorityBand,
      recommendation,
      eligibilityStatus,
      applicationEffort: effort,
      evidenceCoverage: coverage,
      ...gapCounts,
      gapsJson: toPrismaJson(gaps),
      eligibilityChecksJson: toPrismaJson(canonicalChecks.length > 0 ? canonicalChecks : eligibility.checks),
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
      priorityBand,
      recommendation,
      eligibilityStatus,
      applicationEffort: effort,
      evidenceCoverage: coverage,
      ...gapCounts,
      gapsJson: toPrismaJson(gaps),
      eligibilityChecksJson: toPrismaJson(canonicalChecks.length > 0 ? canonicalChecks : eligibility.checks),
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
