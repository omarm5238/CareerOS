import "dotenv/config";

import { readdirSync } from "node:fs";

import { OpportunityTruthError } from "@/features/jobs/opportunities/provenance/errors";
import { hashJobSnapshot } from "@/features/jobs/opportunities/provenance/hash-job-snapshot";
import { classifyEvidenceResult } from "@/features/jobs/opportunities/provenance/semantic-evidence";
import { assertCurrentOpportunityForPreparation, getCurrentOpportunityAnalysis } from "@/features/jobs/opportunities/provenance/current-opportunity";
import { analyzeJobOpportunity } from "@/features/jobs/opportunities/lib/analyze-job-opportunity";
import { CANONICAL_MATCH_VERSION, evaluateCanonicalMatch } from "@/features/jobs/matching/canonical-match";
import { getDiscoveryProfileForUser } from "@/features/jobs/discovery/lib/get-discovery-profile";
import { getDiscoveryResumeInput } from "@/features/jobs/discovery/lib/run-job-discovery";
import { upsertDiscoveryProfile } from "@/features/jobs/discovery/lib/update-discovery-profile";
import { getSkillsModuleDataForUser } from "@/features/skills/lib/get-skills-module-data-for-user";
import {
  currentRecommendationTexts,
  extractEvidenceCatalog,
  getActiveResumeRevisionForUser,
  getCurrentResumeAnalysis,
  getCurrentResumeContextForUser,
  hashResumeContent,
  normalizeResumeContentForHash,
  RESUME_ANALYZER_VERSION,
} from "@/features/resume/provenance";
import { saveResumeAnalysis } from "@/features/resume/lib/save-resume-analysis";
import { prepareApplicationPackage } from "@/features/application-packages/lib/prepare-application-package";
import type { ResumeAnalysisResult } from "@/features/resume/types";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function analysis(role = "Backend Engineer"): ResumeAnalysisResult {
  return {
    role,
    experienceLevel: "Mid-Level",
    completenessScore: 70,
    detectedSkills: [],
    suggestedFocus: [],
    strengths: [],
    weaknesses: [],
    atsRecommendations: [
      "Add a clear Skills section near the top",
      "Add a GitHub link for your projects",
    ],
    profileSummary: role,
    warnings: [],
    analysisSource: "rule_based",
    resume: { filename: "resume.pdf", fileSize: 100, textLength: 100 },
  };
}

const skillsResume = `
Skills
TypeScript, Node.js, PostgreSQL, React

Projects
CareerOS — TypeScript API
https://github.com/example/careeros

Experience
Backend Engineer, Full-time
Jan 2022 - Jan 2024
Built TypeScript services.
`;

const goResume = `
Skills
Go, PostgreSQL

Experience
Backend Engineer, Full-time
Mar 2023 - Mar 2025
Built Go services for a product team.
`;

const projectDotNet = `
Projects
Personal .NET inventory
A personal project using .NET and C#.
`;

async function save(userId: string, filename: string, fullText: string) {
  return saveResumeAnalysis({
    userId,
    filename,
    mimeType: "application/pdf",
    fileSize: fullText.length,
    textLength: fullText.length,
    textPreview: fullText.slice(0, 80),
    fullText,
    analysis: analysis(),
  });
}

async function job(userId: string, title: string, description: string) {
  return prisma.jobPosting.create({
    data: { userId, title, company: "CareerOS QA", location: "Istanbul", description },
  });
}

function hasSkill(skills: string[], name: string) {
  return skills.some((skill) => skill.toLowerCase() === name.toLowerCase());
}

async function main() {
  const migrationCount = readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
  assert(migrationCount >= 22, `migration count is ${migrationCount}`);
  const juniorBackend = evaluateCanonicalMatch({
    title: "Junior Backend Engineer",
    location: "Istanbul, Türkiye",
    description: "Required: TypeScript, Node.js, and PostgreSQL. Junior backend role. Onsite in Istanbul. This posting includes enough detail for a deterministic eligibility decision and is not a thin listing.",
  }, {
    roleTargets: ["Backend Engineer", "Software Engineer", "Full-Stack Engineer"],
    experienceLevel: "Mid-Level",
    skills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go", "Prisma"],
    evidenceSkills: ["TypeScript", "JavaScript", "React", "Next.js", "PostgreSQL", "Node.js", "Go", "Prisma"],
    countryCode: "TR",
    countryNames: ["Türkiye", "Istanbul"],
    workModes: ["REMOTE"],
  });
  assert(juniorBackend.eligibility === "ELIGIBLE" && juniorBackend.band === "STRONG" && juniorBackend.score === 99, `M30B junior backend changed to ${juniorBackend.eligibility} ${juniorBackend.band} ${juniorBackend.score}`);

  const normalizedA = normalizeResumeContentForHash("Alpha\r\nline  \r\n\r\n\r\nBeta");
  const normalizedB = normalizeResumeContentForHash("Alpha\nline\n\nBeta");
  assert(normalizedA === normalizedB, "line endings and extra blank lines were not normalized");
  assert(hashResumeContent("Same\nbody") === hashResumeContent("Same\r\nbody"), "same content produced different hashes");
  assert(hashResumeContent("resume.pdf\nAlpha") !== hashResumeContent("resume.pdf\nBeta"), "meaningful content did not change the hash");
  assert(hashResumeContent("Alpha body") === hashResumeContent("Alpha body"), "hash was not stable");
  const catalog = extractEvidenceCatalog(skillsResume);
  assert(catalog.hasSkillsSection, "skills section was not recognized");
  assert(catalog.links.some((link) => link.kind === "github"), "github link was not recognized");
  assert(catalog.projects.length > 0 && catalog.projects.every((project) => project.commercial === false), "projects were treated as commercial");
  assert(currentRecommendationTexts(["Add a clear Skills section", "Add a GitHub link"], catalog).length === 0, "obsolete recommendations stayed current");
  const dotnet = extractEvidenceCatalog(projectDotNet);
  assert(dotnet.projects.some((project) => project.technologies.includes(".NET")), ".NET project evidence was missed");
  assert(dotnet.experiences.length === 0, "a personal project became employment");
  assert(extractEvidenceCatalog("Built software.").experiences.every((item) => item.durationMonths === null), "years were invented");

  const sameJob = { title: "Backend Engineer", company: "CareerOS", location: "Istanbul", description: "Required: TypeScript." };
  assert(hashJobSnapshot(sameJob) === hashJobSnapshot({ ...sameJob }), "job hash was unstable");
  assert(hashJobSnapshot(sameJob) !== hashJobSnapshot({ ...sameJob, description: "Required: C#." }), "material job change kept the same hash");
  assert(CANONICAL_MATCH_VERSION === "m30b-canonical-v1", "canonical match version drifted");

  assert(classifyEvidenceResult({
    requirement: { normalizedName: "relevant experience", rawText: "relevant experience", sourceExcerpt: "relevant experience", yearsRequired: null, category: "OTHER" },
    matches: [{ matchStrength: "DIRECT", evidenceType: "SKILL", verified: true }],
  }) === "UNKNOWN", "ambiguous requirement was promoted");
  assert(classifyEvidenceResult({
    requirement: { normalizedName: "C#", rawText: "C#", sourceExcerpt: "C#", yearsRequired: null, category: "SKILL" },
    matches: [{ matchStrength: "NONE", evidenceType: "OTHER", verified: false }],
  }) === "MISSING", "missing evidence was matched");
  assert(classifyEvidenceResult({
    requirement: { normalizedName: "TypeScript", rawText: "TypeScript", sourceExcerpt: "Required: TypeScript", yearsRequired: null, category: "SKILL" },
    matches: [{ matchStrength: "DIRECT", evidenceType: "SKILL", verified: true }],
  }) === "MATCHED", "verified TypeScript evidence was not matched");
  assert(classifyEvidenceResult({
    requirement: { normalizedName: ".NET", rawText: "3+ years commercial .NET", sourceExcerpt: "3+ years commercial .NET experience", yearsRequired: 3, category: "SKILL" },
    matches: [{ matchStrength: "DIRECT", evidenceType: "PROJECT", verified: true, commercial: false, durationMonths: null }],
  }) === "MISSING", "personal .NET project was treated as commercial years");

  const stamp = Date.now();
  const email = `m31-${stamp}@careeros.local`;
  const otherEmail = `m31-other-${stamp}@careeros.local`;
  const surfaceEmail = `m31-surface-${stamp}@careeros.local`;
  const legacyEmail = `m31-legacy-only-${stamp}@careeros.local`;
  const user = await prisma.user.create({ data: { name: "M31", email } });
  const other = await prisma.user.create({ data: { name: "M31 other", email: otherEmail } });
  try {
    const legacy = await prisma.resumeDocument.create({
      data: {
        userId: user.id,
        filename: "legacy.pdf",
        mimeType: "application/pdf",
        fileSize: 10,
        textLength: 10,
        textPreview: "preview only",
        analysis: { create: { detectedRole: "Legacy", experienceLevel: "Mid-Level", completenessScore: 1, detectedSkills: [], suggestedFocus: [], warnings: [] } },
      },
    });
    assert(await getActiveResumeRevisionForUser(user.id) === null, "legacy document became active");
    assert(await getCurrentResumeAnalysis(user.id) === null, "legacy analysis became current");
    assert(await prisma.resumeSourceRevision.count({ where: { resumeDocumentId: legacy.id } }) === 0, "legacy preview was hashed");

    const first = await save(user.id, "resume.pdf", skillsResume);
    const active = await getActiveResumeRevisionForUser(user.id);
    assert(active?.revisionNumber === 1 && active.sourceFilename === "resume.pdf" && active.isActive, "first revision was not active");
    const current = await getCurrentResumeAnalysis(user.id);
    assert(current?.analysisId === first.analysis?.id, "current analysis did not bind to the new revision");
    assert(current?.sourceContentHash === active?.contentHash, "analysis hash diverged from the revision");
    assert(current?.analyzerVersion === RESUME_ANALYZER_VERSION, "analyzer version was not stored");
    const stored = await prisma.resumeAnalysis.findUnique({ where: { id: current!.analysisId } });
    assert(!JSON.stringify(stored?.atsRecommendations).toLowerCase().includes("skills section"), "skills-section recommendation leaked");
    assert(!JSON.stringify(stored?.atsRecommendations).toLowerCase().includes("github"), "github recommendation leaked");

    const duplicate = await save(user.id, "copy.pdf", skillsResume.replace(/\n/g, "\r\n"));
    assert(await prisma.resumeSourceRevision.count({ where: { userId: user.id } }) === 1, "same content created another revision");
    assert((await getActiveResumeRevisionForUser(user.id))?.revisionId === active?.revisionId, "duplicate upload changed active truth");
    const superseded = await prisma.resumeAnalysis.findUnique({ where: { id: first.analysis!.id } });
    assert(superseded?.freshness === "SUPERSEDED", "previous same-content analysis stayed current");
    assert((await getCurrentResumeAnalysis(user.id))?.analysisId === duplicate.analysis?.id, "duplicate upload did not become current");

    const changed = await save(user.id, "resume.pdf", `${skillsResume}\nExperience\nAdded a new role.`);
    const next = await getActiveResumeRevisionForUser(user.id);
    assert(next && next.revisionId !== active?.revisionId && next.revisionNumber === 2, "new content did not create revision 2");
    assert(next.contentHash !== active?.contentHash, "filename preserved the old hash");
    const oldAnalysis = await prisma.resumeAnalysis.findUnique({ where: { id: duplicate.analysis!.id } });
    assert(oldAnalysis?.freshness === "STALE" && oldAnalysis.staleReason === "ACTIVE_REVISION_CHANGED", "old analysis stayed current after revision change");
    assert((await prisma.resumeSourceRevision.count({ where: { userId: user.id, isActive: true } })) === 1, "more than one revision is active");

    const typescriptJob = await job(user.id, "Backend Engineer", "Backend Engineer in Istanbul. Required: TypeScript. Nice to have: portfolio.");
    await analyzeJobOpportunity(user.id, typescriptJob.id);
    const snapshot = await getCurrentOpportunityAnalysis({ userId: user.id, jobPostingId: typescriptJob.id });
    assert(snapshot?.resumeRevisionId === next?.revisionId, "snapshot missed the active revision");
    assert(snapshot?.resumeAnalysisId === (await getCurrentResumeAnalysis(user.id))?.analysisId, "snapshot missed the current analysis");
    assert(snapshot?.resumeContentHash === next?.contentHash, "snapshot missed the content hash");
    assert(snapshot?.canonicalMatchVersion === CANONICAL_MATCH_VERSION, "snapshot missed the canonical match version");
    const beforeCount = await prisma.opportunityAnalysisSnapshot.count({ where: { jobPostingId: typescriptJob.id } });
    await analyzeJobOpportunity(user.id, typescriptJob.id, { force: true });
    const afterCount = await prisma.opportunityAnalysisSnapshot.count({ where: { jobPostingId: typescriptJob.id } });
    assert(afterCount === beforeCount + 1, "reanalysis overwrote the snapshot");
    const tsRequirement = await prisma.jobRequirement.findFirst({
      where: { jobPostingId: typescriptJob.id, normalizedName: "TypeScript" },
      include: { evidenceMatches: true },
    });
    assert(tsRequirement, "TypeScript requirement was not extracted");
    assert(tsRequirement.evidenceMatches.some((match) => match.verified && match.resumeRevisionId === next?.revisionId && match.sourceContentHash === next?.contentHash), "TypeScript evidence was not bound");
    assert(classifyEvidenceResult({ requirement: tsRequirement, matches: tsRequirement.evidenceMatches }) === "MATCHED", "TypeScript was not matched");

    const csharpJob = await job(user.id, "C# Engineer", "Required: C#. JavaScript, Java, and C++ experience is not C#.");
    await analyzeJobOpportunity(user.id, csharpJob.id);
    const csharp = await prisma.jobRequirement.findFirst({ where: { jobPostingId: csharpJob.id, normalizedName: "C#" }, include: { evidenceMatches: true } });
    assert(csharp && classifyEvidenceResult({ requirement: csharp, matches: csharp.evidenceMatches }) === "MISSING", "C# was matched from a different language");

    const dotnetJob = await job(user.id, ".NET Engineer", "Required: 3+ years commercial .NET experience.");
    await save(user.id, "dotnet.pdf", projectDotNet);
    await analyzeJobOpportunity(user.id, dotnetJob.id);
    const dotnetRequirement = await prisma.jobRequirement.findFirst({
      where: { jobPostingId: dotnetJob.id, normalizedName: ".NET" },
      include: { evidenceMatches: true },
    });
    const dotnetResult = dotnetRequirement
      ? classifyEvidenceResult({ requirement: dotnetRequirement, matches: dotnetRequirement.evidenceMatches })
      : "MISSING";
    assert(dotnetResult === "MISSING", `commercial .NET was ${dotnetResult}`);

    const ambiguousJob = await job(user.id, "Generalist", "Required: relevant experience with modern technologies.");
    await save(user.id, "skills-again.pdf", skillsResume);
    await analyzeJobOpportunity(user.id, ambiguousJob.id);
    const ambiguous = await prisma.jobRequirement.findFirst({
      where: { jobPostingId: ambiguousJob.id, normalizedName: "relevant experience" },
      include: { evidenceMatches: true },
    });
    assert(ambiguous && classifyEvidenceResult({ requirement: ambiguous, matches: ambiguous.evidenceMatches }) === "UNKNOWN", "ambiguous requirement was matched");

    const mutable = await job(user.id, "Mutable role", "Required: TypeScript for the backend service.");
    await analyzeJobOpportunity(user.id, mutable.id);
    const stableHash = hashJobSnapshot({ title: "Mutable role", company: "CareerOS QA", location: "Istanbul", description: "Required: TypeScript for the backend service." });
    await prisma.jobPosting.update({ where: { id: mutable.id }, data: { applicationNotes: "ui only" } });
    assert(await getCurrentOpportunityAnalysis({ userId: user.id, jobPostingId: mutable.id }), "non-material metadata invalidated the snapshot");
    await prisma.jobPosting.update({ where: { id: mutable.id }, data: { description: "Required: C# for the backend service." } });
    assert(await getCurrentOpportunityAnalysis({ userId: user.id, jobPostingId: mutable.id }) === null, "material job change stayed current");
    const staleSnapshot = await prisma.opportunityAnalysisSnapshot.findFirst({ where: { jobPostingId: mutable.id, jobSnapshotHash: stableHash } });
    assert(staleSnapshot?.status === "STALE", "old job snapshot was not marked stale");

    const historical = await prisma.applicationPackage.create({
      data: {
        userId: user.id,
        jobPostingId: typescriptJob.id,
        version: 1,
        status: "SUBMITTED",
        contextFingerprint: "historical-m31",
        opportunitySnapshotJson: { marker: "keep" },
      },
    });
    await save(user.id, "after-package.pdf", `${skillsResume}\nA later resume revision.`);
    let blocked = false;
    try {
      await prepareApplicationPackage(user.id, typescriptJob.id);
    } catch (error) {
      blocked = error instanceof OpportunityTruthError && (error.code === "STALE_OPPORTUNITY_ANALYSIS" || error.code === "CURRENT_OPPORTUNITY_ANALYSIS_NOT_FOUND");
    }
    assert(blocked, "stale preparation was allowed");
    const reread = await prisma.applicationPackage.findUnique({ where: { id: historical.id } });
    assert(JSON.stringify(reread?.opportunitySnapshotJson) === JSON.stringify({ marker: "keep" }), "historical package was rewritten");
    assert(reread?.status === "SUBMITTED", "historical package status changed");

    const surface = await prisma.user.create({ data: { name: "M31 surface", email: surfaceEmail } });
    const legacyUser = await prisma.user.create({ data: { name: "M31 legacy", email: legacyEmail } });
    await save(surface.id, "revision-a.pdf", skillsResume);
    const revisionA = await getCurrentResumeContextForUser(surface.id);
    assert(revisionA.status === "CURRENT" && hasSkill(revisionA.analysis.detectedSkills, "TypeScript"), "revision A was not current");
    assert(!hasSkill(revisionA.analysis.detectedSkills, "Go"), "revision A inherited Go");
    await upsertDiscoveryProfile(surface.id, {
      locationTargets: [{ countryCode: "DE", country: "Germany", cities: ["Berlin"], enabled: true }],
      workModes: ["REMOTE"],
      excludedKeywords: ["recruiter"],
      searchIntent: {
        excludedTitles: ["Sales Engineer"],
        selectedCountryCodes: ["DE"],
        locationMode: "SELECTED_COUNTRIES",
        preferredTitles: ["Backend Engineer"],
      },
    });
    const profileBefore = await getDiscoveryProfileForUser(surface.id);
    await save(surface.id, "revision-b.pdf", goResume);
    const discoveryB = await getDiscoveryResumeInput(surface.id);
    const skillsB = await getSkillsModuleDataForUser(surface.id);
    const homeB = await getCurrentResumeContextForUser(surface.id);
    assert(discoveryB.status === "CURRENT" && discoveryB.sourceFilename === "revision-b.pdf" && discoveryB.revisionNumber === 2, "discovery did not follow revision B");
    assert(hasSkill(discoveryB.userSkills, "Go") && hasSkill(discoveryB.userSkills, "PostgreSQL") && !hasSkill(discoveryB.userSkills, "TypeScript"), "discovery kept revision A skills");
    assert(skillsB.resumeTruthStatus === "CURRENT" && skillsB.overview && hasSkill(skillsB.overview.detectedSkills, "Go") && hasSkill(skillsB.overview.detectedSkills, "PostgreSQL") && !hasSkill(skillsB.overview.detectedSkills, "TypeScript"), "skills kept revision A");
    assert(homeB.status === "CURRENT" && homeB.analysis.filename === "revision-b.pdf" && hasSkill(homeB.analysis.detectedSkills, "Go") && !hasSkill(homeB.analysis.detectedSkills, "TypeScript"), "home kept revision A");
    const profileAfter = await getDiscoveryProfileForUser(surface.id);
    assert(JSON.stringify(profileBefore?.locationTargets) === JSON.stringify(profileAfter?.locationTargets), "resume switch changed target countries");
    assert(JSON.stringify(profileBefore?.workModes) === JSON.stringify(profileAfter?.workModes), "resume switch changed remote mode");
    assert(JSON.stringify(profileBefore?.searchIntent) === JSON.stringify(profileAfter?.searchIntent), "resume switch changed search intent");
    assert(profileAfter?.searchIntent?.excludedTitles?.includes("Sales Engineer"), "excluded titles were lost");
    assert(await prisma.resumeAnalysis.count({ where: { resumeDocument: { userId: surface.id } } }) >= 2, "historical analyses were not preserved");

    const currentBId = homeB.analysis.analysisId;
    await prisma.resumeAnalysis.update({
      where: { id: currentBId },
      data: { freshness: "STALE", staleReason: "MANUAL_INVALIDATION" },
    });
    const staleDiscovery = await getDiscoveryResumeInput(surface.id);
    const staleSkills = await getSkillsModuleDataForUser(surface.id);
    const staleHome = await getCurrentResumeContextForUser(surface.id);
    assert(staleDiscovery.status === "CURRENT_ANALYSIS_NOT_FOUND" && staleDiscovery.userSkills.length === 0, "stale discovery fell back to an older revision");
    assert(!staleSkills.hasResume && staleSkills.resumeTruthStatus === "CURRENT_ANALYSIS_NOT_FOUND", "stale skills fell back to an older revision");
    assert(staleHome.status === "CURRENT_ANALYSIS_NOT_FOUND", "stale home fell back to an older revision");
    assert(await prisma.resumeAnalysis.count({ where: { id: revisionA.status === "CURRENT" ? revisionA.analysis.analysisId : "" } }) === 1, "revision A history was deleted");

    const legacyDocument = await prisma.resumeDocument.create({
      data: {
        userId: legacyUser.id,
        filename: "legacy-only.pdf",
        mimeType: "application/pdf",
        fileSize: 20,
        textLength: 20,
        textPreview: "legacy preview",
        analysis: {
          create: {
            detectedRole: "Legacy Role",
            experienceLevel: "Senior",
            completenessScore: 40,
            detectedSkills: ["LegacySkill"],
            suggestedFocus: [],
            warnings: [],
          },
        },
      },
    });
    const legacyDiscovery = await getDiscoveryResumeInput(legacyUser.id);
    const legacySkills = await getSkillsModuleDataForUser(legacyUser.id);
    const legacyHome = await getCurrentResumeContextForUser(legacyUser.id);
    assert(legacyDiscovery.status === "NO_ACTIVE_RESUME" && legacyDiscovery.userSkills.length === 0, "discovery used a legacy analysis");
    assert(!legacySkills.hasResume && legacySkills.resumeTruthStatus === "NO_ACTIVE_RESUME", "skills presented legacy skills as current");
    assert(legacyHome.status === "NO_ACTIVE_RESUME", "home presented a legacy analysis as current");
    assert(await prisma.resumeAnalysis.count({ where: { resumeDocumentId: legacyDocument.id } }) === 1, "legacy history was deleted");
    assert(await prisma.resumeSourceRevision.count({ where: { userId: legacyUser.id } }) === 0, "legacy user was backfilled");

    const [left, right] = await Promise.all([
      save(other.id, "a.pdf", `${skillsResume}\nleft ${stamp}`),
      save(other.id, "b.pdf", `${skillsResume}\nright ${stamp}`),
    ]);
    assert(left.id !== right.id, "concurrent analyses collapsed");
    assert(await prisma.resumeSourceRevision.count({ where: { userId: other.id, isActive: true } }) === 1, "concurrent activation left two active revisions");
    assert(await prisma.resumeSourceRevision.count({ where: { userId: other.id } }) === 2, "concurrent revisions were not both stored");
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail, surfaceEmail, legacyEmail] } } });
  }

  assert(await prisma.user.count({ where: { email: { in: [email, otherEmail, surfaceEmail, legacyEmail] } } }) === 0, "fixture users remained");
  console.log("m31:qa PASS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
