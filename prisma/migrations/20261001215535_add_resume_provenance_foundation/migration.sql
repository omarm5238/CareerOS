-- CreateEnum
CREATE TYPE "ResumeAnalysisFreshness" AS ENUM ('CURRENT', 'STALE', 'SUPERSEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ResumeStaleReason" AS ENUM ('ACTIVE_REVISION_CHANGED', 'SOURCE_CONTENT_CHANGED', 'ANALYZER_VERSION_CHANGED', 'MANUAL_INVALIDATION');

-- AlterEnum
ALTER TYPE "JobOpportunityAnalysisStatus" ADD VALUE 'STALE';

-- AlterTable
ALTER TABLE "jobEvidenceMatch" ADD COLUMN     "resumeRevisionId" TEXT,
ADD COLUMN     "sourceContentHash" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "resumeAnalysis" ADD COLUMN     "analyzerVersion" TEXT,
ADD COLUMN     "freshness" "ResumeAnalysisFreshness",
ADD COLUMN     "sourceContentHash" TEXT,
ADD COLUMN     "sourceRevisionId" TEXT,
ADD COLUMN     "staleReason" "ResumeStaleReason";

-- CreateTable
CREATE TABLE "resumeSourceRevision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeDocumentId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumeSourceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunityAnalysisSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "legacyAnalysisId" TEXT,
    "resumeDocumentId" TEXT NOT NULL,
    "resumeRevisionId" TEXT NOT NULL,
    "resumeContentHash" TEXT NOT NULL,
    "resumeAnalysisId" TEXT NOT NULL,
    "jobSnapshotHash" TEXT NOT NULL,
    "canonicalMatchVersion" TEXT NOT NULL,
    "opportunityAnalyzerVersion" TEXT NOT NULL,
    "status" "JobOpportunityAnalysisStatus" NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunityAnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resumeSourceRevision_resumeDocumentId_key" ON "resumeSourceRevision"("resumeDocumentId");

-- CreateIndex
CREATE INDEX "resumeSourceRevision_userId_createdAt_idx" ON "resumeSourceRevision"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "resumeSourceRevision_contentHash_idx" ON "resumeSourceRevision"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "resumeSourceRevision_userId_revisionNumber_key" ON "resumeSourceRevision"("userId", "revisionNumber");

-- CreateIndex
CREATE INDEX "opportunityAnalysisSnapshot_userId_createdAt_idx" ON "opportunityAnalysisSnapshot"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "opportunityAnalysisSnapshot_jobPostingId_createdAt_idx" ON "opportunityAnalysisSnapshot"("jobPostingId", "createdAt");

-- CreateIndex
CREATE INDEX "opportunityAnalysisSnapshot_resumeRevisionId_idx" ON "opportunityAnalysisSnapshot"("resumeRevisionId");

-- CreateIndex
CREATE INDEX "opportunityAnalysisSnapshot_resumeAnalysisId_idx" ON "opportunityAnalysisSnapshot"("resumeAnalysisId");

-- CreateIndex
CREATE INDEX "opportunityAnalysisSnapshot_jobSnapshotHash_idx" ON "opportunityAnalysisSnapshot"("jobSnapshotHash");

-- CreateIndex
CREATE INDEX "jobEvidenceMatch_resumeRevisionId_idx" ON "jobEvidenceMatch"("resumeRevisionId");

-- CreateIndex
CREATE INDEX "jobEvidenceMatch_verified_idx" ON "jobEvidenceMatch"("verified");

-- CreateIndex
CREATE INDEX "resumeAnalysis_sourceRevisionId_idx" ON "resumeAnalysis"("sourceRevisionId");

-- CreateIndex
CREATE INDEX "resumeAnalysis_freshness_idx" ON "resumeAnalysis"("freshness");

-- AddForeignKey
ALTER TABLE "resumeAnalysis" ADD CONSTRAINT "resumeAnalysis_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "resumeSourceRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobEvidenceMatch" ADD CONSTRAINT "jobEvidenceMatch_resumeRevisionId_fkey" FOREIGN KEY ("resumeRevisionId") REFERENCES "resumeSourceRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeSourceRevision" ADD CONSTRAINT "resumeSourceRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeSourceRevision" ADD CONSTRAINT "resumeSourceRevision_resumeDocumentId_fkey" FOREIGN KEY ("resumeDocumentId") REFERENCES "resumeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunityAnalysisSnapshot" ADD CONSTRAINT "opportunityAnalysisSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunityAnalysisSnapshot" ADD CONSTRAINT "opportunityAnalysisSnapshot_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "jobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunityAnalysisSnapshot" ADD CONSTRAINT "opportunityAnalysisSnapshot_legacyAnalysisId_fkey" FOREIGN KEY ("legacyAnalysisId") REFERENCES "jobOpportunityAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunityAnalysisSnapshot" ADD CONSTRAINT "opportunityAnalysisSnapshot_resumeDocumentId_fkey" FOREIGN KEY ("resumeDocumentId") REFERENCES "resumeDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunityAnalysisSnapshot" ADD CONSTRAINT "opportunityAnalysisSnapshot_resumeRevisionId_fkey" FOREIGN KEY ("resumeRevisionId") REFERENCES "resumeSourceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunityAnalysisSnapshot" ADD CONSTRAINT "opportunityAnalysisSnapshot_resumeAnalysisId_fkey" FOREIGN KEY ("resumeAnalysisId") REFERENCES "resumeAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One active source-resume revision per user. Zero active rows remain valid.
CREATE UNIQUE INDEX "resumeSourceRevision_one_active"
ON "resumeSourceRevision" ("userId")
WHERE "isActive" = true;
