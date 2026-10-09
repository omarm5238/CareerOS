import "dotenv/config";

import { readdirSync, statSync } from "node:fs";

import { canAutoQueue, evaluateCanonicalMatch } from "@/features/jobs/matching/canonical-match";
import { projectCurrentDiscoveryMatch } from "@/features/jobs/matching/project-current-match";
import { getDiscoveryResultsForUser } from "@/features/jobs/discovery/lib/get-discovery-results";
import { getJobPostingByIdForUser } from "@/features/jobs/lib/get-job-posting-by-id-for-user";
import { analyzeJobOpportunity } from "@/features/jobs/opportunities/lib/analyze-job-opportunity";
import { classifyEvidenceResult } from "@/features/jobs/opportunities/provenance/semantic-evidence";
import { canonicalResumeSkills } from "@/features/resume/provenance/normalize-resume-skills";
import { isObsoleteRecommendation } from "@/features/resume/provenance/recommendation-freshness";
import { getCurrentResumeAnalysis, getCurrentResumeContextForUser } from "@/features/resume/provenance/resolvers";
import type { EvidenceCatalog } from "@/features/resume/provenance/evidence-catalog";
import { getSkillsModuleDataForUser } from "@/features/skills/lib/get-skills-module-data-for-user";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const juniorProfile = {
  roleTargets: ["Full-stack Developer"],
  experienceLevel: "Entry / Junior",
  skills: ["TypeScript", "JavaScript", "Go", "React", "Next.js", "PostgreSQL"],
  evidenceSkills: ["TypeScript", "JavaScript", "Go", "React", "Next.js", "PostgreSQL"],
  countryCode: "TR",
  countryNames: ["Türkiye"],
  workModes: ["REMOTE"],
};

const seniorDotNetJob = {
  title: "Senior .NET Full-stack Developer",
  description: [
    "Senior .NET Full-stack Developer.",
    "Required: C# and .NET.",
    "Must have senior experience.",
    "4+ years commercial software development.",
    "Remote worldwide.",
  ].join(" "),
  location: "Remote",
  workMode: "REMOTE",
};

function emptyCatalog(overrides: Partial<EvidenceCatalog> = {}): EvidenceCatalog {
  return {
    version: 1,
    hasSkillsSection: false,
    skills: [],
    links: [],
    experiences: [],
    projects: [],
    education: [],
    ...overrides,
  };
}

function testLegacyStrongScoreCannotStayCurrent() {
  const current = evaluateCanonicalMatch(seniorDotNetJob, juniorProfile);
  assert(current.eligibility === "INELIGIBLE", `expected INELIGIBLE, got ${current.eligibility}`);
  assert(current.band === "INELIGIBLE", `expected INELIGIBLE band, got ${current.band}`);
  assert(current.score === null, "ineligible canonical score must stay null");
  assert(current.blockingReasons.includes("SENIORITY_MISMATCH"), `missing seniority blocker: ${current.blockingReasons.join(",")}`);
  assert(current.blockingReasons.includes("CORE_STACK_MISMATCH"), `missing stack blocker: ${current.blockingReasons.join(",")}`);
  assert(!current.blockingReasons.includes("EXPERIENCE_MISMATCH"), "4 years must not invent the 5-year experience blocker");
  assert(!canAutoQueue(current), "ineligible job must not auto-queue");

  const stored = { score: 79, band: "STRONG" };
  const projected = projectCurrentDiscoveryMatch(seniorDotNetJob, juniorProfile);
  assert(projected.finalScore !== stored.score, "current DTO reused the legacy 79");
  assert(projected.scoreBand !== stored.band, "current DTO reused STRONG");
  assert(projected.eligibility === "INELIGIBLE", "projection did not follow canonical eligibility");
  assert(!/strong match/i.test(projected.matchSummary), "current prose still says strong match");

  const seniorProfile = {
    ...juniorProfile,
    experienceLevel: "Senior",
    skills: [...juniorProfile.skills, "C#", ".NET"],
    evidenceSkills: [...juniorProfile.skills, "C#", ".NET"],
  };
  const revisionA = projectCurrentDiscoveryMatch(seniorDotNetJob, seniorProfile);
  const revisionB = projectCurrentDiscoveryMatch(seniorDotNetJob, juniorProfile);
  assert(revisionA.eligibility !== "INELIGIBLE", "senior fixture should not be the ineligible revision");
  assert(revisionB.eligibility === "INELIGIBLE", "activating the junior revision must replace the current result");
  assert(revisionA.scoreBand !== revisionB.scoreBand, "revision change left the current band unchanged");
}

function testSkillNormalization() {
  assert(canonicalResumeSkills(["TypeScript", "Languages: TypeScript"]).join("|") === "TypeScript", "TypeScript prefix was not collapsed");
  assert(canonicalResumeSkills(["PostgreSQL", "Databases / Data: PostgreSQL"]).join("|") === "PostgreSQL", "PostgreSQL prefix was not collapsed");
  assert(canonicalResumeSkills(["Next.js", "Frameworks / Backend: Next.js"]).join("|") === "Next.js", "Next.js prefix was not collapsed");
  assert(canonicalResumeSkills(["OpenAI API", "AI / Testing / Tools: OpenAI API"]).join("|") === "OpenAI API", "OpenAI API prefix was not collapsed");
  const distinct = canonicalResumeSkills(["Java", "JavaScript", "C", "C#", "C++", "PostgreSQL", "MySQL", "React", "React Native"]);
  for (const skill of ["Java", "JavaScript", "C", "C#", "C++", "PostgreSQL", "MySQL", "React", "React Native"]) {
    assert(distinct.includes(skill), `${skill} was collapsed`);
  }
  const backend = evaluateCanonicalMatch(
    { title: "Backend Engineer", description: "Required: .NET and C# for backend services. Remote worldwide.", location: "Remote" },
    { ...juniorProfile, experienceLevel: "Mid-Level", skills: ["Backend"], evidenceSkills: ["Backend"] },
  );
  assert(backend.blockingReasons.includes("CORE_STACK_MISMATCH"), ".NET was inferred from generic backend experience");
}

function testRecommendationTruth() {
  const catalog = emptyCatalog({
    hasSkillsSection: true,
    links: [{ kind: "github", url: "https://github.com/example/project", excerpt: "github" }],
  });
  assert(isObsoleteRecommendation("No clear skills section separating technical skills from tools", catalog), "false skills-section claim remained current");
  assert(isObsoleteRecommendation("Include a link to portfolio or deployed projects", catalog), "false portfolio-link claim remained current");
  assert(!isObsoleteRecommendation("Expand on measurable achievements or impact in projects", catalog), "measurable-achievements guidance was removed");
  assert(!isObsoleteRecommendation("Add a GitHub link", emptyCatalog()), "a missing link was treated as present");
}

async function verifyRealCv() {
  const user = await prisma.user.findFirst({
    where: { resumeSourceRevisions: { some: { sourceFilename: "cv.pdf", isActive: true } } },
    select: { id: true },
  });
  if (!user) {
    console.log("real-cv: no active cv.pdf user in this database");
    return;
  }

  const context = await getCurrentResumeContextForUser(user.id);
  assert(context.status === "CURRENT", "active cv.pdf context is not current");
  const currentAnalysis = await getCurrentResumeAnalysis(user.id);
  assert(currentAnalysis, "current resume analysis is missing");
  const skills = await getSkillsModuleDataForUser(user.id);
  const resumeCount = context.analysis.detectedSkills.length;
  const skillsCount = skills.overview?.detectedSkills.length ?? -1;
  assert(resumeCount === skillsCount, `detected skill counts differ: resume ${resumeCount}, skills ${skillsCount}`);
  assert(!context.analysis.detectedSkills.some((skill) => skill.includes(":")), "category-prefixed skill identities remain");

  const discovered = await prisma.discoveredJob.findFirst({
    where: { userId: user.id, title: "Senior .NET Full-stack Developer", company: "Lemon.io" },
    select: { id: true, finalScore: true, scoreBand: true },
  });
  if (discovered) {
    assert(discovered.finalScore === 79 && discovered.scoreBand === "STRONG", "historical 79 STRONG row was rewritten");
    const results = await getDiscoveryResultsForUser(user.id, { filter: "all" });
    const card = results.find((job) => job.id === discovered.id);
    assert(card, "Senior .NET discovery card was dropped");
    assert(card.finalScore !== 79 && card.scoreBand !== "STRONG", "discovery still presents 79 STRONG");
    assert(card.hardBlockers.includes("SENIORITY_MISMATCH"), `discovery blockers: ${card.hardBlockers.join(",")}`);
    assert(card.hardBlockers.includes("CORE_STACK_MISMATCH"), `discovery blockers: ${card.hardBlockers.join(",")}`);
    assert(!/strong match/i.test(card.matchSummary ?? ""), "discovery prose still says strong match");
  }

  const saved = await prisma.jobPosting.findFirst({
    where: { userId: user.id, title: "Senior .NET Full-stack Developer", company: "Lemon.io" },
    select: { id: true },
  });
  assert(saved, "saved Senior .NET job is missing");
  const detail = await getJobPostingByIdForUser(user.id, saved.id);
  const marker = detail?.analysis?.aiWarnings.find((warning) => warning.startsWith("CANONICAL|")) ?? "";
  assert(marker.includes("INELIGIBLE"), `saved job current marker is ${marker}`);
  assert(!/strong match/i.test(detail?.analysis?.fitSummary ?? ""), "saved job fit summary still says strong match");

  const beforeSnapshots = await prisma.opportunityAnalysisSnapshot.count({ where: { userId: user.id, jobPostingId: saved.id } });
  const analysis = await analyzeJobOpportunity(user.id, saved.id, { force: true });
  const snapshot = await prisma.opportunityAnalysisSnapshot.findFirst({
    where: { userId: user.id, jobPostingId: saved.id, status: { notIn: ["STALE", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    include: { resumeRevision: { select: { sourceFilename: true, revisionNumber: true, contentHash: true } } },
  });
  assert(snapshot, "fresh opportunity snapshot was not created");
  assert(snapshot.resumeRevision.sourceFilename === "cv.pdf", "snapshot is not bound to cv.pdf");
  assert(snapshot.resumeRevision.revisionNumber === 1, "snapshot is not bound to revision 1");
  assert(snapshot.resumeRevisionId === context.revision.revisionId, "snapshot revision does not match the active revision");
  assert(snapshot.resumeContentHash === context.revision.contentHash, "snapshot hash does not match the active resume");
  assert(snapshot.resumeAnalysisId === context.analysis.analysisId, "snapshot analysis does not match the current analysis");
  assert(analysis.eligibilityStatus === "INELIGIBLE", `fresh opportunity eligibility is ${analysis.eligibilityStatus}`);
  const checkText = JSON.stringify(analysis.eligibilityChecks);
  assert(checkText.includes("SENIORITY_MISMATCH"), "fresh opportunity omitted the seniority blocker");
  assert(checkText.includes("CORE_STACK_MISMATCH"), "fresh opportunity omitted the stack blocker");

  const requirements = await prisma.jobRequirement.findMany({
    where: { userId: user.id, jobPostingId: saved.id },
    include: { evidenceMatches: true },
  });
  const interesting = requirements.filter((row) => /^(c#|\.net)$/i.test(row.normalizedName) || (row.yearsRequired != null && /commercial/i.test(row.rawText)));
  assert(interesting.length > 0, `no stack or seniority requirements were extracted: ${requirements.map((row) => row.normalizedName).join(" | ")}`);
  for (const row of interesting) {
    const result = classifyEvidenceResult({
      requirement: row,
      matches: row.evidenceMatches.map((match) => ({
        matchStrength: match.matchStrength,
        evidenceType: match.evidenceType,
        verified: match.verified,
      })),
    });
    assert(result === "MISSING", `${row.normalizedName} evidence is ${result}`);
    assert(!row.evidenceMatches.some((match) => match.evidenceType === "PROJECT" && match.matchStrength !== "NONE"), `${row.normalizedName} used a project as evidence`);
  }

  const catalog = currentAnalysis.catalog;
  const skillsSectionClaim = context.analysis.weaknesses.find((item) => /skills section/i.test(item));
  const portfolioClaim = context.analysis.suggestedFocus.find((item) => /portfolio or deployed projects/i.test(item));
  const measurableClaim = context.analysis.suggestedFocus.find((item) => /measurable achievements/i.test(item));
  if (skillsSectionClaim && catalog?.hasSkillsSection) {
    assert(isObsoleteRecommendation(skillsSectionClaim, catalog), "skills-section recommendation was not corrected");
  }
  if (portfolioClaim && catalog?.links.some((link) => link.kind === "github" || link.kind === "portfolio" || link.kind === "project")) {
    assert(isObsoleteRecommendation(portfolioClaim, catalog), "portfolio recommendation was not corrected");
  }
  if (measurableClaim && catalog) {
    assert(!isObsoleteRecommendation(measurableClaim, catalog), "measurable-achievements guidance was removed");
  }
  console.log(JSON.stringify({
    activeResume: {
      filename: context.revision.sourceFilename,
      revisionNumber: context.revision.revisionNumber,
      hashPrefix: context.revision.contentHash.slice(0, 12),
      analysisId: context.analysis.analysisId,
      freshness: "CURRENT",
      detectedSkills: resumeCount,
    },
    snapshot: {
      id: snapshot.id,
      jobId: snapshot.jobPostingId,
      resumeRevisionId: snapshot.resumeRevisionId,
      hashPrefix: snapshot.resumeContentHash.slice(0, 12),
      resumeAnalysisId: snapshot.resumeAnalysisId,
      status: snapshot.status,
      createdAt: snapshot.createdAt.toISOString(),
      previousSnapshotCount: beforeSnapshots,
    },
    canonical: {
      eligibility: analysis.eligibilityStatus,
      score: analysis.opportunityScore,
      blockers: marker.split("|")[4] ?? "",
    },
    evidence: interesting.map((row) => ({
      requirement: row.normalizedName,
      result: classifyEvidenceResult({
        requirement: row,
        matches: row.evidenceMatches.map((match) => ({
          matchStrength: match.matchStrength,
          evidenceType: match.evidenceType,
          verified: match.verified,
        })),
      }),
    })),
    recommendation: {
      hasSkillsSection: catalog?.hasSkillsSection ?? null,
      linkKinds: [...new Set(catalog?.links.map((link) => link.kind) ?? [])],
      skillsSectionClaimCorrected: Boolean(skillsSectionClaim && catalog && isObsoleteRecommendation(skillsSectionClaim, catalog)),
      portfolioClaimCorrected: Boolean(portfolioClaim && catalog && isObsoleteRecommendation(portfolioClaim, catalog)),
      measurableClaimKept: Boolean(measurableClaim && catalog && !isObsoleteRecommendation(measurableClaim, catalog)),
    },
  }));
}

async function main() {
  const migrations = readdirSync("prisma/migrations").filter((name) => statSync(`prisma/migrations/${name}`).isDirectory());
  assert(migrations.length >= 22, `migration count is ${migrations.length}`);
  testLegacyStrongScoreCannotStayCurrent();
  testSkillNormalization();
  testRecommendationTruth();
  await verifyRealCv();
  console.log("m31 closure qa passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
