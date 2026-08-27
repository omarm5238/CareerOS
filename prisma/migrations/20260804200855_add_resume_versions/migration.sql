-- CreateEnum
CREATE TYPE "ResumeVersionType" AS ENUM ('JOB_SPECIFIC', 'ROLE_BASED', 'GENERAL');

-- CreateEnum
CREATE TYPE "ResumeVersionStatus" AS ENUM ('DRAFT', 'READY', 'USED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResumeVersionRevisionSource" AS ENUM ('AI_GENERATED', 'USER_EDITED', 'RULE_BASED_FALLBACK', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ResumeVersionGenerationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "resumeVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceResumeDocumentId" TEXT,
    "sourceResumeAnalysisId" TEXT,
    "targetJobId" TEXT,
    "targetJobAnalysisId" TEXT,
    "type" "ResumeVersionType" NOT NULL DEFAULT 'JOB_SPECIFIC',
    "title" TEXT NOT NULL,
    "status" "ResumeVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "activeRevisionId" TEXT,
    "alignmentScoreBefore" INTEGER,
    "alignmentScoreAfter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "resumeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumeVersionRevision" (
    "id" TEXT NOT NULL,
    "resumeVersionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "source" "ResumeVersionRevisionSource" NOT NULL,
    "contentJson" JSONB NOT NULL,
    "keywordCoverageJson" JSONB NOT NULL,
    "warningsJson" JSONB NOT NULL,
    "changeLogJson" JSONB NOT NULL,
    "evidenceNotesJson" JSONB NOT NULL,
    "inputSnapshotJson" JSONB NOT NULL,
    "alignmentScoreBefore" INTEGER,
    "alignmentScoreAfter" INTEGER,
    "model" TEXT,
    "aiSource" TEXT,
    "generationStatus" "ResumeVersionGenerationStatus" NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumeVersionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resumeVersion_activeRevisionId_key" ON "resumeVersion"("activeRevisionId");

-- CreateIndex
CREATE INDEX "resumeVersion_userId_idx" ON "resumeVersion"("userId");

-- CreateIndex
CREATE INDEX "resumeVersion_targetJobId_idx" ON "resumeVersion"("targetJobId");

-- CreateIndex
CREATE INDEX "resumeVersion_status_idx" ON "resumeVersion"("status");

-- CreateIndex
CREATE INDEX "resumeVersion_updatedAt_idx" ON "resumeVersion"("updatedAt");

-- CreateIndex
CREATE INDEX "resumeVersionRevision_userId_idx" ON "resumeVersionRevision"("userId");

-- CreateIndex
CREATE INDEX "resumeVersionRevision_resumeVersionId_idx" ON "resumeVersionRevision"("resumeVersionId");

-- CreateIndex
CREATE INDEX "resumeVersionRevision_createdAt_idx" ON "resumeVersionRevision"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "resumeVersionRevision_resumeVersionId_revisionNumber_key" ON "resumeVersionRevision"("resumeVersionId", "revisionNumber");

-- AddForeignKey
ALTER TABLE "resumeVersion" ADD CONSTRAINT "resumeVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeVersion" ADD CONSTRAINT "resumeVersion_sourceResumeDocumentId_fkey" FOREIGN KEY ("sourceResumeDocumentId") REFERENCES "resumeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeVersion" ADD CONSTRAINT "resumeVersion_sourceResumeAnalysisId_fkey" FOREIGN KEY ("sourceResumeAnalysisId") REFERENCES "resumeAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeVersion" ADD CONSTRAINT "resumeVersion_targetJobId_fkey" FOREIGN KEY ("targetJobId") REFERENCES "jobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeVersion" ADD CONSTRAINT "resumeVersion_targetJobAnalysisId_fkey" FOREIGN KEY ("targetJobAnalysisId") REFERENCES "jobAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeVersion" ADD CONSTRAINT "resumeVersion_activeRevisionId_fkey" FOREIGN KEY ("activeRevisionId") REFERENCES "resumeVersionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeVersionRevision" ADD CONSTRAINT "resumeVersionRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeVersionRevision" ADD CONSTRAINT "resumeVersionRevision_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "resumeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
