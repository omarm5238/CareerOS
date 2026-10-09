import "dotenv/config";

import { RESUME_ANALYZER_VERSION } from "@/features/resume/provenance/constants";
import { hashJobSnapshot } from "@/features/jobs/opportunities/provenance/hash-job-snapshot";
import { buildSubmissionPackage } from "@/features/application-packages/readiness/build-submission-package";
import { evaluateApplicationReadiness } from "@/features/application-packages/readiness/evaluate-application-readiness";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function seed(label: string, jobTitle: string, description: string, level: string, skills: string[]) {
  const stamp = `${Date.now()}-${label}`;
  const user = await prisma.user.create({ data: { name: label, email: `m32-2-${stamp}@careeros.local` } });
  const document = await prisma.resumeDocument.create({
    data: { userId: user.id, filename: "cv.pdf", mimeType: "application/pdf", fileSize: 12, textLength: 40, textPreview: "preview" },
  });
  const hash = "d".repeat(64);
  const revision = await prisma.resumeSourceRevision.create({
    data: { userId: user.id, resumeDocumentId: document.id, revisionNumber: 1, contentHash: hash, sourceFilename: "cv.pdf", isActive: true },
  });
  const analysis = await prisma.resumeAnalysis.create({
    data: {
      resumeDocumentId: document.id,
      detectedRole: "Software Engineer",
      experienceLevel: level,
      completenessScore: 80,
      detectedSkills: skills,
      suggestedFocus: [],
      warnings: [],
      sourceRevisionId: revision.id,
      sourceContentHash: hash,
      analyzerVersion: RESUME_ANALYZER_VERSION,
      freshness: "CURRENT",
    },
  });
  const job = await prisma.jobPosting.create({
    data: { userId: user.id, title: jobTitle, company: "CareerOS QA", location: "Istanbul", description },
  });
  const snapshot = await prisma.opportunityAnalysisSnapshot.create({
    data: {
      userId: user.id,
      jobPostingId: job.id,
      resumeDocumentId: document.id,
      resumeRevisionId: revision.id,
      resumeContentHash: hash,
      resumeAnalysisId: analysis.id,
      jobSnapshotHash: hashJobSnapshot(job),
      canonicalMatchVersion: "m30b-canonical-v1",
      opportunityAnalyzerVersion: "opportunity-analysis-v1",
      status: "COMPLETED",
      snapshotJson: { fixture: true },
    },
  });
  const version = await prisma.resumeVersion.create({
    data: { userId: user.id, targetJobId: job.id, title: "Tailored", status: "READY" },
  });
  const tailored = await prisma.resumeVersionRevision.create({
    data: {
      resumeVersionId: version.id,
      userId: user.id,
      revisionNumber: 1,
      source: "RULE_BASED_FALLBACK",
      contentJson: { summary: "tailored" },
      keywordCoverageJson: {},
      warningsJson: [],
      changeLogJson: [],
      evidenceNotesJson: [],
      inputSnapshotJson: {},
    },
  });
  await prisma.resumeVersion.update({ where: { id: version.id }, data: { activeRevisionId: tailored.id } });
  return { user, document, revision, analysis, job, snapshot, version, tailored };
}

async function cleanup(userId: string) {
  await prisma.application.updateMany({ where: { userId }, data: { submittedPackageId: null, submittedExecutionAttemptId: null } });
  await prisma.applicationSubmissionAttempt.deleteMany({ where: { userId } });
  await prisma.applicationExecutionSession.deleteMany({ where: { userId } });
  await prisma.applicationPackage.deleteMany({ where: { userId } });
  await prisma.application.deleteMany({ where: { userId } });
  await prisma.resumeVersion.updateMany({ where: { userId }, data: { activeRevisionId: null } });
  await prisma.resumeVersionRevision.deleteMany({ where: { userId } });
  await prisma.resumeVersion.deleteMany({ where: { userId } });
  await prisma.opportunityAnalysisSnapshot.deleteMany({ where: { userId } });
  await prisma.resumeAnalysis.deleteMany({ where: { resumeDocument: { userId } } });
  await prisma.resumeSourceRevision.deleteMany({ where: { userId } });
  await prisma.resumeDocument.deleteMany({ where: { userId } });
  await prisma.jobPosting.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

async function main() {
  const eligibleDescription = "Required: TypeScript and PostgreSQL. Backend engineer role building HTTP APIs for a product team. This posting has enough detail for a deterministic eligibility decision.";
  const fixture = await seed("eligible", "Backend Engineer", eligibleDescription, "Junior", ["TypeScript", "PostgreSQL"]);
  try {
    const built = await buildSubmissionPackage(fixture.user.id, fixture.job.id, {
      tailoredResumeVersionId: fixture.version.id,
      tailoredResumeRevisionId: fixture.tailored.id,
    });
    assert(built.readiness.status === "READY", `expected READY, got ${built.readiness.status} ${built.readiness.blockers.join(",")}`);
    const again = await buildSubmissionPackage(fixture.user.id, fixture.job.id, {
      tailoredResumeVersionId: fixture.version.id,
      tailoredResumeRevisionId: fixture.tailored.id,
    });
    assert(again.reused && again.packageId === built.packageId, "same semantic input did not reuse the package");

    const before = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: built.packageId } });
    const documentB = await prisma.resumeDocument.create({
      data: { userId: fixture.user.id, filename: "cv-b.pdf", mimeType: "application/pdf", fileSize: 12, textLength: 40, textPreview: "preview" },
    });
    const revisionB = await prisma.resumeSourceRevision.create({
      data: {
        userId: fixture.user.id,
        resumeDocumentId: documentB.id,
        revisionNumber: 2,
        contentHash: "e".repeat(64),
        sourceFilename: "cv-b.pdf",
        isActive: false,
      },
    });
    await prisma.resumeSourceRevision.update({ where: { id: fixture.revision.id }, data: { isActive: false } });
    await prisma.resumeSourceRevision.update({ where: { id: revisionB.id }, data: { isActive: true } });
    const stale = await evaluateApplicationReadiness(fixture.user.id, built.packageId);
    assert(stale.status === "BLOCKED", "stale package stayed executable");
    assert(stale.blockers.includes("SOURCE_REVISION_MISMATCH") || stale.blockers.includes("PACKAGE_STALE"), stale.blockers.join(","));
    const after = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: built.packageId } });
    assert(after.packageHash === before.packageHash, "package hash changed after a later resume");
    assert(after.sourceResumeRevisionId === before.sourceResumeRevisionId, "package source revision was rewritten");
    assert(JSON.stringify(after.packageJson) === JSON.stringify(before.packageJson), "package payload was rewritten");

    await prisma.resumeSourceRevision.update({ where: { id: revisionB.id }, data: { isActive: false } });
    await prisma.resumeSourceRevision.update({ where: { id: fixture.revision.id }, data: { isActive: true } });
    const restored = await evaluateApplicationReadiness(fixture.user.id, built.packageId);
    assert(restored.status === "READY", `restored package was not READY: ${restored.blockers.join(",")}`);

    const regenerated = await buildSubmissionPackage(fixture.user.id, fixture.job.id, {
      forceNew: true,
      tailoredResumeVersionId: fixture.version.id,
      tailoredResumeRevisionId: fixture.tailored.id,
    });
    assert(regenerated.packageId !== built.packageId, "regenerate overwrote the original package");
    assert(regenerated.packageHash === built.packageHash, "unchanged regenerate changed the hash");

    const nextTailored = await prisma.resumeVersionRevision.create({
      data: {
        resumeVersionId: fixture.version.id,
        userId: fixture.user.id,
        revisionNumber: 2,
        source: "USER_EDITED",
        contentJson: { summary: "changed" },
        keywordCoverageJson: {},
        warningsJson: [],
        changeLogJson: [],
        evidenceNotesJson: [],
        inputSnapshotJson: {},
      },
    });
    await prisma.resumeVersion.update({ where: { id: fixture.version.id }, data: { activeRevisionId: nextTailored.id } });
    const changed = await buildSubmissionPackage(fixture.user.id, fixture.job.id, {
      tailoredResumeVersionId: fixture.version.id,
      tailoredResumeRevisionId: nextTailored.id,
    });
    assert(changed.packageHash !== built.packageHash, "changed tailored revision kept the old hash");
    const oldAfterTailor = await evaluateApplicationReadiness(fixture.user.id, built.packageId);
    assert(oldAfterTailor.status === "BLOCKED" && oldAfterTailor.blockers.includes("TAILORED_REVISION_MISMATCH"), oldAfterTailor.blockers.join(","));

    await prisma.resumeAnalysis.update({ where: { id: fixture.analysis.id }, data: { freshness: "STALE" } });
    const staleAnalysis = await evaluateApplicationReadiness(fixture.user.id, changed.packageId);
    assert(staleAnalysis.status === "BLOCKED" && staleAnalysis.blockers.includes("STALE_RESUME_ANALYSIS"), staleAnalysis.blockers.join(","));
    await prisma.resumeAnalysis.update({ where: { id: fixture.analysis.id }, data: { freshness: "CURRENT" } });

    await prisma.opportunityAnalysisSnapshot.update({ where: { id: fixture.snapshot.id }, data: { status: "STALE" } });
    const staleOpportunity = await evaluateApplicationReadiness(fixture.user.id, changed.packageId);
    assert(staleOpportunity.status === "BLOCKED" && staleOpportunity.blockers.includes("STALE_OPPORTUNITY"), staleOpportunity.blockers.join(","));
    await prisma.opportunityAnalysisSnapshot.update({ where: { id: fixture.snapshot.id }, data: { status: "COMPLETED" } });

    await prisma.applicationPackage.update({
      where: { id: changed.packageId },
      data: { sourceResumeContentHash: "f".repeat(64) },
    });
    const hashMismatch = await evaluateApplicationReadiness(fixture.user.id, changed.packageId);
    assert(hashMismatch.blockers.includes("RESUME_HASH_MISMATCH"), hashMismatch.blockers.join(","));
    await prisma.applicationPackage.update({
      where: { id: changed.packageId },
      data: { sourceResumeContentHash: fixture.revision.contentHash },
    });

    const otherDocument = await prisma.resumeDocument.create({
      data: { userId: fixture.user.id, filename: "other.pdf", mimeType: "application/pdf", fileSize: 8, textLength: 8, textPreview: "other" },
    });
    const otherAnalysis = await prisma.resumeAnalysis.create({
      data: {
        resumeDocumentId: otherDocument.id,
        detectedRole: "Software Engineer",
        experienceLevel: "Junior",
        completenessScore: 70,
        detectedSkills: ["TypeScript"],
        suggestedFocus: [],
        warnings: [],
        analyzerVersion: RESUME_ANALYZER_VERSION,
        freshness: "STALE",
      },
    });
    await prisma.applicationPackage.update({
      where: { id: changed.packageId },
      data: { resumeAnalysisId: otherAnalysis.id },
    });
    const analysisMismatch = await evaluateApplicationReadiness(fixture.user.id, changed.packageId);
    assert(analysisMismatch.blockers.includes("RESUME_ANALYSIS_MISMATCH"), analysisMismatch.blockers.join(","));
    await prisma.applicationPackage.update({
      where: { id: changed.packageId },
      data: { resumeAnalysisId: fixture.analysis.id },
    });

    const newerSnapshot = await prisma.opportunityAnalysisSnapshot.create({
      data: {
        userId: fixture.user.id,
        jobPostingId: fixture.job.id,
        resumeDocumentId: fixture.document.id,
        resumeRevisionId: fixture.revision.id,
        resumeContentHash: fixture.revision.contentHash,
        resumeAnalysisId: fixture.analysis.id,
        jobSnapshotHash: hashJobSnapshot(fixture.job),
        canonicalMatchVersion: "m30b-canonical-v1",
        opportunityAnalyzerVersion: "opportunity-analysis-v1",
        status: "COMPLETED",
        snapshotJson: { fixture: "newer" },
      },
    });
    const snapshotMismatch = await evaluateApplicationReadiness(fixture.user.id, changed.packageId);
    assert(snapshotMismatch.blockers.includes("OPPORTUNITY_SNAPSHOT_MISMATCH"), snapshotMismatch.blockers.join(","));
    await prisma.opportunityAnalysisSnapshot.update({ where: { id: newerSnapshot.id }, data: { status: "STALE" } });
    const missingCommunication = await buildSubmissionPackage(fixture.user.id, fixture.job.id, {
      forceNew: true,
      tailoredResumeVersionId: fixture.version.id,
      tailoredResumeRevisionId: nextTailored.id,
      communicationRequired: true,
    });
    assert(missingCommunication.readiness.blockers.includes("REQUIRED_COMMUNICATION_MISSING"), missingCommunication.readiness.blockers.join(","));
  } finally {
    await cleanup(fixture.user.id);
  }

  const bare = await prisma.user.create({ data: { name: "bare", email: `m32-2-bare-${Date.now()}@careeros.local` } });
  try {
    const job = await prisma.jobPosting.create({
      data: { userId: bare.id, title: "Backend Engineer", company: "CareerOS QA", description: eligibleDescription },
    });
    const pack = await prisma.applicationPackage.create({
      data: { userId: bare.id, jobPostingId: job.id, version: 1, contextFingerprint: "legacy" },
    });
    const blocked = await evaluateApplicationReadiness(bare.id, pack.id);
    assert(blocked.status === "BLOCKED" && blocked.blockers.includes("NO_ACTIVE_RESUME"), blocked.blockers.join(","));
    assert(blocked.blockers.includes("TAILORED_RESUME_MISSING"), "missing tailored revision was not blocked");
  } finally {
    await cleanup(bare.id);
  }

  const dotnet = await seed(
    "dotnet",
    "Senior .NET Full-stack Developer",
    "Required: C#, .NET, and 4+ years of commercial experience. Senior full-stack role.",
    "Entry / Junior",
    ["TypeScript", "JavaScript", "Go", "React", "Next.js", "PostgreSQL"],
  );
  try {
    const built = await buildSubmissionPackage(dotnet.user.id, dotnet.job.id, {
      tailoredResumeVersionId: dotnet.version.id,
      tailoredResumeRevisionId: dotnet.tailored.id,
    });
    assert(built.readiness.status === "BLOCKED", "ineligible Senior .NET package became ready");
    assert(built.readiness.blockers.includes("JOB_INELIGIBLE"), built.readiness.blockers.join(","));
    assert(built.readiness.provenance.eligibility === "INELIGIBLE", "readiness did not use M30B eligibility");
  } finally {
    await cleanup(dotnet.user.id);
  }

  console.log("m32-2:qa PASS");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
