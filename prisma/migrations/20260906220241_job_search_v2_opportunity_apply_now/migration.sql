-- CreateEnum
CREATE TYPE "JobRequirementCategory" AS ENUM ('SKILL', 'EXPERIENCE', 'EDUCATION', 'LANGUAGE', 'CERTIFICATION', 'LOCATION', 'AUTHORIZATION', 'SECURITY_CLEARANCE', 'EMPLOYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "JobRequirementImportance" AS ENUM ('REQUIRED', 'STRONGLY_PREFERRED', 'PREFERRED', 'OPTIONAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobEvidenceType" AS ENUM ('WORK_EXPERIENCE', 'PROJECT', 'RESUME', 'SKILL', 'EDUCATION', 'CERTIFICATION', 'PORTFOLIO', 'OTHER');

-- CreateEnum
CREATE TYPE "JobEvidenceMatchStrength" AS ENUM ('DIRECT', 'STRONG', 'PARTIAL', 'TRANSFERABLE', 'NONE');

-- CreateEnum
CREATE TYPE "JobOpportunityAnalysisStatus" AS ENUM ('PENDING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "JobOpportunityAnalysisSource" AS ENUM ('RULE_BASED', 'AI_ASSISTED', 'FALLBACK');

-- CreateEnum
CREATE TYPE "JobEligibilityStatus" AS ENUM ('ELIGIBLE', 'LIKELY_ELIGIBLE', 'REVIEW_REQUIRED', 'LIKELY_INELIGIBLE', 'INELIGIBLE');

-- CreateEnum
CREATE TYPE "OpportunityRecommendation" AS ENUM ('APPLY', 'APPLY_WITH_CAUTION', 'REVIEW_FIRST', 'SKIP');

-- CreateEnum
CREATE TYPE "ApplicationEffort" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OpportunityPriorityBand" AS ENUM ('APPLY_NOW', 'HIGH_PRIORITY', 'GOOD_OPPORTUNITY', 'REVIEW_FIRST', 'LOW_PRIORITY', 'SKIP');

-- CreateEnum
CREATE TYPE "ApplicationPreparationMode" AS ENUM ('MANUAL', 'ASSISTED', 'AUTO_PREPARE');

-- CreateEnum
CREATE TYPE "ApplicationPackageStatus" AS ENUM ('PREPARING', 'READY_FOR_REVIEW', 'APPROVED', 'SUBMISSION_STARTED', 'SUBMITTED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationReadinessStatus" AS ENUM ('READY', 'NEEDS_REVIEW', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ApplicationPackageQaStatus" AS ENUM ('NOT_RUN', 'PASS', 'NEEDS_REPAIR', 'USER_INPUT_REQUIRED', 'BLOCKED', 'FAILED');

-- AlterTable
ALTER TABLE "jobDiscoveryProfile" ADD COLUMN     "applicationPreparationMode" "ApplicationPreparationMode" NOT NULL DEFAULT 'ASSISTED';

-- CreateTable
CREATE TABLE "jobRequirement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "category" "JobRequirementCategory" NOT NULL,
    "importance" "JobRequirementImportance" NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "sourceExcerpt" TEXT NOT NULL,
    "yearsRequired" INTEGER,
    "proficiencyRequired" TEXT,
    "isExplicit" BOOLEAN NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobEvidenceMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobRequirementId" TEXT NOT NULL,
    "evidenceType" "JobEvidenceType" NOT NULL,
    "evidenceSourceId" TEXT,
    "evidenceLabel" TEXT NOT NULL,
    "evidenceExcerpt" TEXT,
    "matchStrength" "JobEvidenceMatchStrength" NOT NULL,
    "reasoning" TEXT,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobEvidenceMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobOpportunityAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "status" "JobOpportunityAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "roleFit" INTEGER NOT NULL,
    "skillFit" INTEGER NOT NULL,
    "experienceFit" INTEGER NOT NULL,
    "evidenceFit" INTEGER NOT NULL,
    "locationFit" INTEGER NOT NULL,
    "authorizationFit" INTEGER NOT NULL,
    "freshnessScore" INTEGER NOT NULL,
    "applicationEffortScore" INTEGER NOT NULL,
    "opportunityScore" INTEGER NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "priorityBand" "OpportunityPriorityBand" NOT NULL,
    "recommendation" "OpportunityRecommendation" NOT NULL,
    "eligibilityStatus" "JobEligibilityStatus" NOT NULL,
    "applicationEffort" "ApplicationEffort" NOT NULL,
    "evidenceCoverage" INTEGER NOT NULL,
    "criticalGapCount" INTEGER NOT NULL DEFAULT 0,
    "importantGapCount" INTEGER NOT NULL DEFAULT 0,
    "minorGapCount" INTEGER NOT NULL DEFAULT 0,
    "optionalGapCount" INTEGER NOT NULL DEFAULT 0,
    "gapsJson" JSONB NOT NULL DEFAULT '[]',
    "eligibilityChecksJson" JSONB NOT NULL DEFAULT '[]',
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "contextFingerprint" TEXT NOT NULL,
    "analysisSource" "JobOpportunityAnalysisSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobOpportunityAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationPackage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostingId" TEXT,
    "applicationQueueItemId" TEXT,
    "applicationId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "resumeVersionId" TEXT,
    "resumeVersionRevisionId" TEXT,
    "coverLetterDraftId" TEXT,
    "applicationEmailDraftId" TEXT,
    "status" "ApplicationPackageStatus" NOT NULL DEFAULT 'PREPARING',
    "readinessStatus" "ApplicationReadinessStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "qaStatus" "ApplicationPackageQaStatus" NOT NULL DEFAULT 'NOT_RUN',
    "opportunitySnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "evidenceSnapshotJson" JSONB NOT NULL DEFAULT '[]',
    "gapSnapshotJson" JSONB NOT NULL DEFAULT '[]',
    "eligibilitySnapshotJson" JSONB NOT NULL DEFAULT '[]',
    "requiredUserInputsJson" JSONB NOT NULL DEFAULT '[]',
    "qaSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "contextFingerprint" TEXT NOT NULL,
    "preparedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "submissionStartedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicationPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobRequirement_userId_idx" ON "jobRequirement"("userId");

-- CreateIndex
CREATE INDEX "jobRequirement_jobPostingId_idx" ON "jobRequirement"("jobPostingId");

-- CreateIndex
CREATE INDEX "jobRequirement_category_idx" ON "jobRequirement"("category");

-- CreateIndex
CREATE INDEX "jobRequirement_importance_idx" ON "jobRequirement"("importance");

-- CreateIndex
CREATE UNIQUE INDEX "jobRequirement_jobPostingId_fingerprint_key" ON "jobRequirement"("jobPostingId", "fingerprint");

-- CreateIndex
CREATE INDEX "jobEvidenceMatch_userId_idx" ON "jobEvidenceMatch"("userId");

-- CreateIndex
CREATE INDEX "jobEvidenceMatch_jobRequirementId_idx" ON "jobEvidenceMatch"("jobRequirementId");

-- CreateIndex
CREATE INDEX "jobEvidenceMatch_matchStrength_idx" ON "jobEvidenceMatch"("matchStrength");

-- CreateIndex
CREATE UNIQUE INDEX "jobEvidenceMatch_jobRequirementId_fingerprint_key" ON "jobEvidenceMatch"("jobRequirementId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "jobOpportunityAnalysis_jobPostingId_key" ON "jobOpportunityAnalysis"("jobPostingId");

-- CreateIndex
CREATE INDEX "jobOpportunityAnalysis_userId_idx" ON "jobOpportunityAnalysis"("userId");

-- CreateIndex
CREATE INDEX "jobOpportunityAnalysis_jobPostingId_idx" ON "jobOpportunityAnalysis"("jobPostingId");

-- CreateIndex
CREATE INDEX "jobOpportunityAnalysis_priorityBand_idx" ON "jobOpportunityAnalysis"("priorityBand");

-- CreateIndex
CREATE INDEX "jobOpportunityAnalysis_opportunityScore_idx" ON "jobOpportunityAnalysis"("opportunityScore");

-- CreateIndex
CREATE INDEX "jobOpportunityAnalysis_priorityScore_idx" ON "jobOpportunityAnalysis"("priorityScore");

-- CreateIndex
CREATE INDEX "jobOpportunityAnalysis_eligibilityStatus_idx" ON "jobOpportunityAnalysis"("eligibilityStatus");

-- CreateIndex
CREATE INDEX "jobOpportunityAnalysis_updatedAt_idx" ON "jobOpportunityAnalysis"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobOpportunityAnalysis_userId_jobPostingId_key" ON "jobOpportunityAnalysis"("userId", "jobPostingId");

-- CreateIndex
CREATE INDEX "applicationPackage_userId_idx" ON "applicationPackage"("userId");

-- CreateIndex
CREATE INDEX "applicationPackage_jobPostingId_idx" ON "applicationPackage"("jobPostingId");

-- CreateIndex
CREATE INDEX "applicationPackage_applicationId_idx" ON "applicationPackage"("applicationId");

-- CreateIndex
CREATE INDEX "applicationPackage_status_idx" ON "applicationPackage"("status");

-- CreateIndex
CREATE INDEX "applicationPackage_readinessStatus_idx" ON "applicationPackage"("readinessStatus");

-- CreateIndex
CREATE INDEX "applicationPackage_qaStatus_idx" ON "applicationPackage"("qaStatus");

-- CreateIndex
CREATE INDEX "applicationPackage_updatedAt_idx" ON "applicationPackage"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "applicationPackage_userId_jobPostingId_version_key" ON "applicationPackage"("userId", "jobPostingId", "version");

-- AddForeignKey
ALTER TABLE "jobRequirement" ADD CONSTRAINT "jobRequirement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobRequirement" ADD CONSTRAINT "jobRequirement_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "jobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobEvidenceMatch" ADD CONSTRAINT "jobEvidenceMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobEvidenceMatch" ADD CONSTRAINT "jobEvidenceMatch_jobRequirementId_fkey" FOREIGN KEY ("jobRequirementId") REFERENCES "jobRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobOpportunityAnalysis" ADD CONSTRAINT "jobOpportunityAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobOpportunityAnalysis" ADD CONSTRAINT "jobOpportunityAnalysis_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "jobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "jobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_applicationQueueItemId_fkey" FOREIGN KEY ("applicationQueueItemId") REFERENCES "applicationQueueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "resumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_resumeVersionRevisionId_fkey" FOREIGN KEY ("resumeVersionRevisionId") REFERENCES "resumeVersionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_coverLetterDraftId_fkey" FOREIGN KEY ("coverLetterDraftId") REFERENCES "communicationDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_applicationEmailDraftId_fkey" FOREIGN KEY ("applicationEmailDraftId") REFERENCES "communicationDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
