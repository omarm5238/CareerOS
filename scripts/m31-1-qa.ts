import "dotenv/config";

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { Prisma } from "@/generated/prisma/client";
import {
  JobOpportunityAnalysisStatus,
  ResumeAnalysisFreshness,
  ResumeStaleReason,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db/prisma";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

const contentHash = createHash("sha256").update("m31-1 fixture source content").digest("hex");
const otherHash = createHash("sha256").update("m31-1 other fixture content").digest("hex");

function checkGeneratedTypes() {
  assert(ResumeAnalysisFreshness.CURRENT === "CURRENT", "freshness enum missing CURRENT");
  assert(ResumeAnalysisFreshness.STALE === "STALE", "freshness enum missing STALE");
  assert(ResumeAnalysisFreshness.SUPERSEDED === "SUPERSEDED", "freshness enum missing SUPERSEDED");
  assert(ResumeAnalysisFreshness.FAILED === "FAILED", "freshness enum missing FAILED");
  assert(ResumeStaleReason.ACTIVE_REVISION_CHANGED === "ACTIVE_REVISION_CHANGED", "stale reason missing");
  assert(ResumeStaleReason.SOURCE_CONTENT_CHANGED === "SOURCE_CONTENT_CHANGED", "content reason missing");
  assert(ResumeStaleReason.ANALYZER_VERSION_CHANGED === "ANALYZER_VERSION_CHANGED", "analyzer reason missing");
  assert(ResumeStaleReason.MANUAL_INVALIDATION === "MANUAL_INVALIDATION", "manual reason missing");
  assert(JobOpportunityAnalysisStatus.STALE === "STALE", "opportunity status missing STALE");
  assert(JobOpportunityAnalysisStatus.PENDING === "PENDING", "existing opportunity status changed");
}

function checkMigrationFile() {
  const root = join(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert(dirs.length === 22, `expected 22 migrations, found ${dirs.length}`);
  const match = dirs.find((entry) => entry.name.endsWith("_add_resume_provenance_foundation"));
  assert(match, "provenance migration is missing");
  const sql = readFileSync(join(root, match.name, "migration.sql"), "utf8");
  assert(sql.includes('CREATE TYPE "ResumeAnalysisFreshness"'), "freshness enum missing from SQL");
  assert(sql.includes('CREATE TYPE "ResumeStaleReason"'), "stale reason enum missing from SQL");
  assert(sql.includes(`ADD VALUE 'STALE'`), "STALE was not added to the existing enum");
  assert(sql.includes('CREATE UNIQUE INDEX "resumeSourceRevision_one_active"'), "one-active index missing");
  assert(sql.includes('WHERE "isActive" = true'), "one-active index is not partial");
  assert(!/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM|UPDATE\s+"/i.test(sql), "migration contains destructive SQL");
  assert(!/INSERT INTO/i.test(sql), "migration backfills rows");
}

async function checkIndexes() {
  const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (
        'resumeSourceRevision',
        'resumeAnalysis',
        'opportunityAnalysisSnapshot',
        'jobEvidenceMatch'
      )
  `;
  const byName = new Map(rows.map((row) => [row.indexname, row.indexdef]));
  const required = [
    "resumeSourceRevision_userId_revisionNumber_key",
    "resumeSourceRevision_userId_createdAt_idx",
    "resumeSourceRevision_contentHash_idx",
    "resumeSourceRevision_one_active",
    "resumeAnalysis_sourceRevisionId_idx",
    "resumeAnalysis_freshness_idx",
    "opportunityAnalysisSnapshot_userId_createdAt_idx",
    "opportunityAnalysisSnapshot_jobPostingId_createdAt_idx",
    "opportunityAnalysisSnapshot_resumeRevisionId_idx",
    "opportunityAnalysisSnapshot_resumeAnalysisId_idx",
    "opportunityAnalysisSnapshot_jobSnapshotHash_idx",
    "jobEvidenceMatch_resumeRevisionId_idx",
    "jobEvidenceMatch_verified_idx",
  ];
  for (const name of required) {
    assert(byName.has(name), `missing index ${name}`);
  }
  assert(
    byName.get("resumeSourceRevision_one_active")?.includes('WHERE ("isActive" = true)'),
    "one-active index definition is not partial",
  );
  console.log(JSON.stringify({ indexes: required }, null, 2));
}

async function counts() {
  const [resumeDocument, resumeAnalysis, jobOpportunityAnalysis, jobEvidenceMatch] = await Promise.all([
    prisma.resumeDocument.count(),
    prisma.resumeAnalysis.count(),
    prisma.jobOpportunityAnalysis.count(),
    prisma.jobEvidenceMatch.count(),
  ]);
  return { resumeDocument, resumeAnalysis, jobOpportunityAnalysis, jobEvidenceMatch };
}

async function provenanceCounts() {
  const [revisions, snapshots, evidenced, verified, linkedAnalyses] = await Promise.all([
    prisma.resumeSourceRevision.count(),
    prisma.opportunityAnalysisSnapshot.count(),
    prisma.jobEvidenceMatch.count({ where: { resumeRevisionId: { not: null } } }),
    prisma.jobEvidenceMatch.count({ where: { verified: true } }),
    prisma.resumeAnalysis.count({ where: { sourceRevisionId: { not: null } } }),
  ]);
  return { revisions, snapshots, evidenced, verified, linkedAnalyses };
}

async function checkPersistence() {
  const before = await counts();
  const provenanceBefore = await provenanceCounts();
  const legacy = await prisma.resumeAnalysis.findFirst({
    where: { analyzerVersion: null },
    select: {
      id: true,
      detectedRole: true,
      analyzerVersion: true,
      sourceContentHash: true,
      freshness: true,
      staleReason: true,
      sourceRevisionId: true,
    },
  });
  assert(legacy, "legacy analysis was backfilled");
  assert(legacy.analyzerVersion == null && legacy.sourceContentHash == null, "legacy analysis was partially backfilled");
  assert(legacy.freshness == null && legacy.staleReason == null && legacy.sourceRevisionId == null, "legacy analysis was marked current");
  const legacyEvidence = await prisma.jobEvidenceMatch.findFirst({
    select: { id: true, evidenceLabel: true, resumeRevisionId: true, sourceContentHash: true, verified: true },
  });
  if (legacyEvidence) {
    assert(legacyEvidence.resumeRevisionId == null && legacyEvidence.sourceContentHash == null, "legacy evidence gained provenance");
    assert(legacyEvidence.verified === false, "legacy evidence was auto-verified");
  }

  const emailA = `m31-1-a-${Date.now()}@careeros.local`;
  const emailB = `m31-1-b-${Date.now()}@careeros.local`;
  try {
    const userA = await prisma.user.create({ data: { name: "M31.1 A", email: emailA } });
    const userB = await prisma.user.create({ data: { name: "M31.1 B", email: emailB } });
    const documentA1 = await prisma.resumeDocument.create({
      data: {
        userId: userA.id,
        filename: "same-name.pdf",
        mimeType: "application/pdf",
        fileSize: 10,
        textLength: 80,
        textPreview: "preview only",
        analysis: {
          create: {
            detectedRole: "Software Engineer",
            experienceLevel: "Mid-Level",
            completenessScore: 1,
            detectedSkills: [],
            suggestedFocus: [],
            warnings: [],
          },
        },
      },
      include: { analysis: true },
    });
    const documentA2 = await prisma.resumeDocument.create({
      data: {
        userId: userA.id,
        filename: "same-name.pdf",
        mimeType: "application/pdf",
        fileSize: 11,
        textLength: 90,
        textPreview: "different preview",
        analysis: {
          create: {
            detectedRole: "Software Engineer",
            experienceLevel: "Mid-Level",
            completenessScore: 1,
            detectedSkills: [],
            suggestedFocus: [],
            warnings: [],
          },
        },
      },
      include: { analysis: true },
    });
    const documentB = await prisma.resumeDocument.create({
      data: {
        userId: userB.id,
        filename: "other.pdf",
        mimeType: "application/pdf",
        fileSize: 12,
        textLength: 90,
        textPreview: "other",
        analysis: {
          create: {
            detectedRole: "Software Engineer",
            experienceLevel: "Mid-Level",
            completenessScore: 1,
            detectedSkills: [],
            suggestedFocus: [],
            warnings: [],
          },
        },
      },
      include: { analysis: true },
    });
    assert(documentA1.analysis && documentA2.analysis && documentB.analysis, "fixture analyses missing");

    const revision1 = await prisma.resumeSourceRevision.create({
      data: {
        userId: userA.id,
        resumeDocumentId: documentA1.id,
        revisionNumber: 1,
        contentHash,
        sourceFilename: "same-name.pdf",
        isActive: true,
        activatedAt: null,
      },
    });
    const loadedRevision = await prisma.resumeSourceRevision.findUnique({ where: { id: revision1.id } });
    assert(loadedRevision?.contentHash === contentHash, "content hash did not round-trip");
    assert(loadedRevision?.sourceFilename === "same-name.pdf", "filename did not round-trip");
    assert(loadedRevision?.revisionNumber === 1, "revision number did not round-trip");
    assert(loadedRevision?.activatedAt == null, "activatedAt was not nullable");
    assert(loadedRevision?.isActive === true, "first active revision was not stored");

    let secondActiveFailed = false;
    try {
      await prisma.resumeSourceRevision.create({
        data: {
          userId: userA.id,
          resumeDocumentId: documentA2.id,
          revisionNumber: 2,
          contentHash: otherHash,
          sourceFilename: "same-name.pdf",
          isActive: true,
        },
      });
    } catch (error) {
      secondActiveFailed = isPrismaCode(error, "P2002");
    }
    assert(secondActiveFailed, "second active revision for the same user was accepted");

    const revision2 = await prisma.resumeSourceRevision.create({
      data: {
        userId: userA.id,
        resumeDocumentId: documentA2.id,
        revisionNumber: 2,
        contentHash: otherHash,
        sourceFilename: "same-name.pdf",
        isActive: false,
      },
    });
    await prisma.resumeSourceRevision.update({ where: { id: revision1.id }, data: { isActive: false } });
    const activatedSecond = await prisma.resumeSourceRevision.update({
      where: { id: revision2.id },
      data: { isActive: true, activatedAt: new Date("2026-10-02T00:00:00.000Z") },
    });
    assert(activatedSecond.isActive === true, "revision could not become active after the previous one was cleared");

    const otherUserActive = await prisma.resumeSourceRevision.create({
      data: {
        userId: userB.id,
        resumeDocumentId: documentB.id,
        revisionNumber: 1,
        contentHash: otherHash,
        sourceFilename: "other.pdf",
        isActive: true,
      },
    });
    assert(otherUserActive.isActive === true, "another user could not have an active revision");

    const bound = await prisma.resumeAnalysis.update({
      where: { id: documentA2.analysis.id },
      data: {
        sourceRevisionId: revision2.id,
        sourceContentHash: otherHash,
        analyzerVersion: "m31.1-test",
        freshness: "CURRENT",
        staleReason: null,
      },
    });
    assert(bound.sourceRevisionId === revision2.id && bound.sourceContentHash === otherHash, "analysis provenance did not round-trip");
    assert(bound.analyzerVersion === "m31.1-test" && bound.freshness === "CURRENT", "analysis freshness did not round-trip");

    const job = await prisma.jobPosting.create({
      data: { userId: userA.id, title: "Backend Engineer", company: "Northwind", description: "TypeScript backend role." },
    });
    const legacyAnalysis = await prisma.jobOpportunityAnalysis.create({
      data: {
        userId: userA.id,
        jobPostingId: job.id,
        roleFit: 0,
        skillFit: 0,
        experienceFit: 0,
        evidenceFit: 0,
        locationFit: 0,
        authorizationFit: 0,
        freshnessScore: 0,
        applicationEffortScore: 0,
        opportunityScore: 0,
        priorityScore: 0,
        priorityBand: "SKIP",
        recommendation: "SKIP",
        eligibilityStatus: "INELIGIBLE",
        applicationEffort: "UNKNOWN",
        evidenceCoverage: 0,
        contextFingerprint: `m31-1-${userA.id}`,
        analysisSource: "RULE_BASED",
      },
    });
    const snapshot = await prisma.opportunityAnalysisSnapshot.create({
      data: {
        userId: userA.id,
        jobPostingId: job.id,
        legacyAnalysisId: legacyAnalysis.id,
        resumeDocumentId: documentA2.id,
        resumeRevisionId: revision2.id,
        resumeContentHash: otherHash,
        resumeAnalysisId: documentA2.analysis.id,
        jobSnapshotHash: contentHash,
        canonicalMatchVersion: "m30b",
        opportunityAnalyzerVersion: "m31.1-test",
        status: "STALE",
        snapshotJson: { fixture: true },
      },
    });
    const loadedSnapshot = await prisma.opportunityAnalysisSnapshot.findUnique({ where: { id: snapshot.id } });
    assert(loadedSnapshot?.resumeRevisionId === revision2.id, "snapshot did not bind the revision");
    assert(loadedSnapshot?.resumeAnalysisId === documentA2.analysis.id, "snapshot did not bind the analysis");
    assert(loadedSnapshot?.jobPostingId === job.id && loadedSnapshot.userId === userA.id, "snapshot did not bind job and user");
    assert(loadedSnapshot?.legacyAnalysisId === legacyAnalysis.id && loadedSnapshot.status === "STALE", "snapshot status did not round-trip");
    const withoutLegacy = await prisma.opportunityAnalysisSnapshot.create({
      data: {
        userId: userA.id,
        jobPostingId: job.id,
        resumeDocumentId: documentA2.id,
        resumeRevisionId: revision2.id,
        resumeContentHash: otherHash,
        resumeAnalysisId: documentA2.analysis.id,
        jobSnapshotHash: otherHash,
        canonicalMatchVersion: "m30b",
        opportunityAnalyzerVersion: "m31.1-test",
        status: "COMPLETED",
        snapshotJson: { fixture: true },
      },
    });
    assert(withoutLegacy.legacyAnalysisId == null, "legacy analysis id was not nullable");

    const requirement = await prisma.jobRequirement.create({
      data: {
        userId: userA.id,
        jobPostingId: job.id,
        category: "SKILL",
        importance: "REQUIRED",
        normalizedName: "typescript",
        rawText: "TypeScript",
        sourceExcerpt: "TypeScript",
        isExplicit: true,
        fingerprint: `m31-1-${userA.id}`,
      },
    });
    const evidence = await prisma.jobEvidenceMatch.create({
      data: {
        userId: userA.id,
        jobRequirementId: requirement.id,
        evidenceType: "SKILL",
        evidenceLabel: "TypeScript",
        matchStrength: "DIRECT",
        fingerprint: `m31-1-evidence-${userA.id}`,
        resumeRevisionId: revision2.id,
        sourceContentHash: otherHash,
        verified: true,
      },
    });
    const loadedEvidence = await prisma.jobEvidenceMatch.findUnique({ where: { id: evidence.id } });
    assert(loadedEvidence?.resumeRevisionId === revision2.id && loadedEvidence.sourceContentHash === otherHash, "evidence provenance did not round-trip");
    const historicalEvidence = await prisma.jobEvidenceMatch.create({
      data: {
        userId: userA.id,
        jobRequirementId: requirement.id,
        evidenceType: "SKILL",
        evidenceLabel: "Unbound",
        matchStrength: "NONE",
        fingerprint: `m31-1-legacy-evidence-${userA.id}`,
      },
    });
    const loadedHistorical = await prisma.jobEvidenceMatch.findUnique({ where: { id: historicalEvidence.id } });
    assert(loadedHistorical?.resumeRevisionId == null && loadedHistorical?.verified === false, "historical evidence default changed");

    const missing = "cm31missingrevision00000000";
    const fkCases: Array<[string, () => Promise<unknown>]> = [
      ["resumeRevisionId", () => prisma.opportunityAnalysisSnapshot.create({
        data: {
          userId: userA.id,
          jobPostingId: job.id,
          resumeDocumentId: documentA2.id,
          resumeRevisionId: missing,
          resumeContentHash: otherHash,
          resumeAnalysisId: documentA2.analysis!.id,
          jobSnapshotHash: otherHash,
          canonicalMatchVersion: "m30b",
          opportunityAnalyzerVersion: "m31.1-test",
          status: "COMPLETED",
          snapshotJson: {},
        },
      })],
      ["resumeAnalysisId", () => prisma.opportunityAnalysisSnapshot.create({
        data: {
          userId: userA.id,
          jobPostingId: job.id,
          resumeDocumentId: documentA2.id,
          resumeRevisionId: revision2.id,
          resumeContentHash: otherHash,
          resumeAnalysisId: missing,
          jobSnapshotHash: otherHash,
          canonicalMatchVersion: "m30b",
          opportunityAnalyzerVersion: "m31.1-test",
          status: "COMPLETED",
          snapshotJson: {},
        },
      })],
      ["jobPostingId", () => prisma.opportunityAnalysisSnapshot.create({
        data: {
          userId: userA.id,
          jobPostingId: missing,
          resumeDocumentId: documentA2.id,
          resumeRevisionId: revision2.id,
          resumeContentHash: otherHash,
          resumeAnalysisId: documentA2.analysis!.id,
          jobSnapshotHash: otherHash,
          canonicalMatchVersion: "m30b",
          opportunityAnalyzerVersion: "m31.1-test",
          status: "COMPLETED",
          snapshotJson: {},
        },
      })],
      ["userId", () => prisma.opportunityAnalysisSnapshot.create({
        data: {
          userId: missing,
          jobPostingId: job.id,
          resumeDocumentId: documentA2.id,
          resumeRevisionId: revision2.id,
          resumeContentHash: otherHash,
          resumeAnalysisId: documentA2.analysis!.id,
          jobSnapshotHash: otherHash,
          canonicalMatchVersion: "m30b",
          opportunityAnalyzerVersion: "m31.1-test",
          status: "COMPLETED",
          snapshotJson: {},
        },
      })],
      ["legacyAnalysisId", () => prisma.opportunityAnalysisSnapshot.create({
        data: {
          userId: userA.id,
          jobPostingId: job.id,
          legacyAnalysisId: missing,
          resumeDocumentId: documentA2.id,
          resumeRevisionId: revision2.id,
          resumeContentHash: otherHash,
          resumeAnalysisId: documentA2.analysis!.id,
          jobSnapshotHash: otherHash,
          canonicalMatchVersion: "m30b",
          opportunityAnalyzerVersion: "m31.1-test",
          status: "COMPLETED",
          snapshotJson: {},
        },
      })],
      ["evidenceRevisionId", () => prisma.jobEvidenceMatch.create({
        data: {
          userId: userA.id,
          jobRequirementId: requirement.id,
          evidenceType: "SKILL",
          evidenceLabel: "Bad revision",
          matchStrength: "NONE",
          fingerprint: `m31-1-bad-${userA.id}`,
          resumeRevisionId: missing,
        },
      })],
    ];
    for (const [name, run] of fkCases) {
      let rejected = false;
      try {
        await run();
      } catch (error) {
        rejected = isPrismaCode(error, "P2003");
      }
      assert(rejected, `${name} foreign key was not enforced`);
    }

    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  }

  const after = await counts();
  const provenanceAfter = await provenanceCounts();
  assert(JSON.stringify(before) === JSON.stringify(after), `row counts changed ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  assert(JSON.stringify(provenanceBefore) === JSON.stringify(provenanceAfter), `provenance rows changed ${JSON.stringify(provenanceBefore)} -> ${JSON.stringify(provenanceAfter)}`);
  const reread = await prisma.resumeAnalysis.findUnique({ where: { id: legacy.id } });
  assert(reread?.detectedRole === legacy.detectedRole && reread.sourceRevisionId == null, "legacy analysis changed");
}

async function main() {
  checkGeneratedTypes();
  checkMigrationFile();
  await checkIndexes();
  await checkPersistence();
  console.log("m31-1:qa PASS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
