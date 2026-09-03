-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscoveredJobStatus" AS ENUM ('CANDIDATE', 'FILTERED', 'DISMISSED', 'STALE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DiscoveryWorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DiscoveryEmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DiscoveryProvider" AS ENUM ('REMOTIVE', 'ARBEITNOW', 'ADZUNA', 'JOOBLE');

-- CreateEnum
CREATE TYPE "DiscoveryScoreBand" AS ENUM ('EXCELLENT', 'STRONG', 'POSSIBLE', 'LOW');

-- CreateEnum
CREATE TYPE "DiscoveryAnalysisSource" AS ENUM ('AI_ENHANCED', 'RULE_BASED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('QUEUED', 'PREPARING', 'HANDED_OFF', 'DISMISSED', 'FAILED');

-- CreateEnum
CREATE TYPE "QueuePriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

-- CreateTable
CREATE TABLE "jobDiscoveryProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleTargetsJson" JSONB NOT NULL DEFAULT '[]',
    "locationTargetsJson" JSONB NOT NULL DEFAULT '[]',
    "workModesJson" JSONB NOT NULL DEFAULT '[]',
    "employmentTypesJson" JSONB NOT NULL DEFAULT '[]',
    "experienceLevelsJson" JSONB NOT NULL DEFAULT '[]',
    "includedKeywordsJson" JSONB NOT NULL DEFAULT '[]',
    "excludedKeywordsJson" JSONB NOT NULL DEFAULT '[]',
    "workAuthorizationJson" JSONB NOT NULL DEFAULT '{}',
    "visaPreference" TEXT,
    "freshnessDays" INTEGER NOT NULL DEFAULT 14,
    "minimumSuitabilityScore" INTEGER NOT NULL DEFAULT 75,
    "dailyTarget" INTEGER NOT NULL DEFAULT 20,
    "providerPreferencesJson" JSONB NOT NULL DEFAULT '{}',
    "generatedFromContextAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobDiscoveryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobDiscoveryRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "querySnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "providerStatsJson" JSONB NOT NULL DEFAULT '[]',
    "providerErrorsJson" JSONB NOT NULL DEFAULT '[]',
    "rawFoundCount" INTEGER NOT NULL DEFAULT 0,
    "normalizedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "hardRejectedCount" INTEGER NOT NULL DEFAULT 0,
    "scoredCount" INTEGER NOT NULL DEFAULT 0,
    "strongMatchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobDiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discoveredJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "normalizedCompany" TEXT NOT NULL,
    "location" TEXT,
    "countryCode" TEXT,
    "workMode" "DiscoveryWorkMode" NOT NULL DEFAULT 'UNKNOWN',
    "employmentType" "DiscoveryEmploymentType" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT NOT NULL,
    "salaryText" TEXT,
    "postedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "canonicalFingerprint" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesSeen" INTEGER NOT NULL DEFAULT 1,
    "lastDiscoveryRunId" TEXT,
    "discoveryStatus" "DiscoveredJobStatus" NOT NULL DEFAULT 'CANDIDATE',
    "deterministicScore" INTEGER,
    "aiScore" INTEGER,
    "finalScore" INTEGER,
    "scoreBand" "DiscoveryScoreBand",
    "matchSummary" TEXT,
    "matchedSkillsJson" JSONB NOT NULL DEFAULT '[]',
    "missingSkillsJson" JSONB NOT NULL DEFAULT '[]',
    "hardBlockersJson" JSONB NOT NULL DEFAULT '[]',
    "softBlockersJson" JSONB NOT NULL DEFAULT '[]',
    "evidenceJson" JSONB NOT NULL DEFAULT '[]',
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "analysisSource" "DiscoveryAnalysisSource",
    "aiModel" TEXT,
    "scoreContextFingerprint" TEXT,
    "jobPostingId" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discoveredJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discoveredJobSource" (
    "id" TEXT NOT NULL,
    "discoveredJobId" TEXT NOT NULL,
    "provider" "DiscoveryProvider" NOT NULL,
    "externalId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "applyUrl" TEXT,
    "sourceMetadataJson" JSONB NOT NULL DEFAULT '{}',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discoveredJobSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discoveredJobId" TEXT NOT NULL,
    "priority" "QueuePriority" NOT NULL DEFAULT 'NORMAL',
    "queueStatus" "QueueStatus" NOT NULL DEFAULT 'QUEUED',
    "jobPostingId" TEXT,
    "resumeVersionId" TEXT,
    "applicationId" TEXT,
    "preparationError" TEXT,
    "preparationSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preparedAt" TIMESTAMP(3),
    "handedOffAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicationQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobDiscoveryProfile_userId_key" ON "jobDiscoveryProfile"("userId");

-- CreateIndex
CREATE INDEX "jobDiscoveryProfile_userId_idx" ON "jobDiscoveryProfile"("userId");

-- CreateIndex
CREATE INDEX "jobDiscoveryRun_userId_idx" ON "jobDiscoveryRun"("userId");

-- CreateIndex
CREATE INDEX "jobDiscoveryRun_createdAt_idx" ON "jobDiscoveryRun"("createdAt");

-- CreateIndex
CREATE INDEX "jobDiscoveryRun_status_idx" ON "jobDiscoveryRun"("status");

-- CreateIndex
CREATE INDEX "discoveredJob_userId_idx" ON "discoveredJob"("userId");

-- CreateIndex
CREATE INDEX "discoveredJob_finalScore_idx" ON "discoveredJob"("finalScore");

-- CreateIndex
CREATE INDEX "discoveredJob_discoveryStatus_idx" ON "discoveredJob"("discoveryStatus");

-- CreateIndex
CREATE INDEX "discoveredJob_lastSeenAt_idx" ON "discoveredJob"("lastSeenAt");

-- CreateIndex
CREATE INDEX "discoveredJob_lastDiscoveryRunId_idx" ON "discoveredJob"("lastDiscoveryRunId");

-- CreateIndex
CREATE UNIQUE INDEX "discoveredJob_userId_canonicalFingerprint_key" ON "discoveredJob"("userId", "canonicalFingerprint");

-- CreateIndex
CREATE INDEX "discoveredJobSource_discoveredJobId_idx" ON "discoveredJobSource"("discoveredJobId");

-- CreateIndex
CREATE INDEX "discoveredJobSource_provider_idx" ON "discoveredJobSource"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "discoveredJobSource_discoveredJobId_provider_externalId_key" ON "discoveredJobSource"("discoveredJobId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "applicationQueueItem_userId_idx" ON "applicationQueueItem"("userId");

-- CreateIndex
CREATE INDEX "applicationQueueItem_queueStatus_idx" ON "applicationQueueItem"("queueStatus");

-- CreateIndex
CREATE INDEX "applicationQueueItem_createdAt_idx" ON "applicationQueueItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "applicationQueueItem_userId_discoveredJobId_key" ON "applicationQueueItem"("userId", "discoveredJobId");

-- AddForeignKey
ALTER TABLE "jobDiscoveryProfile" ADD CONSTRAINT "jobDiscoveryProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobDiscoveryRun" ADD CONSTRAINT "jobDiscoveryRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobDiscoveryRun" ADD CONSTRAINT "jobDiscoveryRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "jobDiscoveryProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discoveredJob" ADD CONSTRAINT "discoveredJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discoveredJob" ADD CONSTRAINT "discoveredJob_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "jobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discoveredJobSource" ADD CONSTRAINT "discoveredJobSource_discoveredJobId_fkey" FOREIGN KEY ("discoveredJobId") REFERENCES "discoveredJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationQueueItem" ADD CONSTRAINT "applicationQueueItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationQueueItem" ADD CONSTRAINT "applicationQueueItem_discoveredJobId_fkey" FOREIGN KEY ("discoveredJobId") REFERENCES "discoveredJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
