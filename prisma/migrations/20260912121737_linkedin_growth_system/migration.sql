-- CreateEnum
CREATE TYPE "LinkedinGrowthGoal" AS ENUM ('GET_HIRED', 'ATTRACT_RECRUITERS', 'BUILD_AUTHORITY', 'SHOWCASE_PROJECTS', 'GROW_NETWORK', 'CAREER_TRANSITION', 'PERSONAL_BRAND', 'LEARN_IN_PUBLIC');

-- CreateEnum
CREATE TYPE "LinkedinGrowthStrategyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'NEEDS_REFRESH', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LinkedinContentPillarPriority" AS ENUM ('CORE', 'SECONDARY', 'EXPERIMENTAL');

-- CreateEnum
CREATE TYPE "LinkedinContentIdeaStatus" AS ENUM ('NEW', 'SHORTLISTED', 'DRAFTED', 'DISMISSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LinkedinContentFormat" AS ENUM ('TEXT_POST', 'STORY_POST', 'TECHNICAL_BREAKDOWN', 'PROJECT_SHOWCASE', 'LESSON_LEARNED', 'CAREER_REFLECTION', 'OPINION', 'CHECKLIST', 'HOW_TO', 'CASE_STUDY', 'MILESTONE', 'QUESTION', 'RESOURCE_SHARE');

-- CreateEnum
CREATE TYPE "LinkedinPostObjective" AS ENUM ('SHOW_EXPERTISE', 'SHOW_PROJECT_EVIDENCE', 'SHOW_LEARNING', 'BUILD_TRUST', 'START_DISCUSSION', 'CAREER_POSITIONING', 'NETWORKING', 'MILESTONE');

-- CreateEnum
CREATE TYPE "LinkedinPostStatus" AS ENUM ('DRAFT', 'REVIEW', 'READY', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LinkedinPostRevisionSource" AS ENUM ('AI_GENERATED', 'USER_EDITED', 'REGENERATED', 'SHORTENED', 'EXPANDED', 'TONE_CHANGED', 'HOOK_REWRITTEN', 'CTA_REWRITTEN', 'REPURPOSED', 'TRANSLATED', 'RULE_BASED_FALLBACK');

-- CreateEnum
CREATE TYPE "LinkedinPublishingPlanStatus" AS ENUM ('DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'CANCELLED', 'STALE');

-- CreateEnum
CREATE TYPE "LinkedinPublishMode" AS ENUM ('MANUAL', 'LINKEDIN_OFFICIAL');

-- CreateEnum
CREATE TYPE "LinkedinPublishingSource" AS ENUM ('USER_CONFIRMED', 'LINKEDIN_OFFICIAL');

-- CreateEnum
CREATE TYPE "LinkedinPerformanceSource" AS ENUM ('USER_ENTERED', 'LINKEDIN_OFFICIAL');

-- CreateEnum
CREATE TYPE "LinkedinGrowthInsightType" AS ENUM ('PILLAR_PERFORMANCE', 'FORMAT_PERFORMANCE', 'AUDIENCE_RESPONSE', 'POSTING_FREQUENCY', 'HOOK_PATTERN', 'CONTENT_GAP', 'RECRUITER_SIGNAL', 'PROFILE_RECOMMENDATION', 'NEXT_POST_RECOMMENDATION');

-- CreateEnum
CREATE TYPE "LinkedinGrowthInsightStatus" AS ENUM ('ACTIVE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "LinkedinEvidenceStrength" AS ENUM ('STRONG', 'MODERATE', 'WEAK');

-- CreateEnum
CREATE TYPE "LinkedinRecruiterRelevance" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "LinkedinTimeliness" AS ENUM ('EVERGREEN', 'TIMELY', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LinkedinContentTone" AS ENUM ('PROFESSIONAL', 'CONVERSATIONAL', 'TECHNICAL', 'REFLECTIVE', 'DIRECT', 'EDUCATIONAL');

-- CreateEnum
CREATE TYPE "LinkedinContentLanguage" AS ENUM ('ENGLISH', 'ARABIC', 'TURKISH');

-- CreateEnum
CREATE TYPE "LinkedinPostQaStatus" AS ENUM ('PASS', 'NEEDS_REVIEW', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LinkedinPostGenerationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "linkedinGrowthProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primaryGoal" "LinkedinGrowthGoal" NOT NULL,
    "secondaryGoalsJson" JSONB NOT NULL DEFAULT '[]',
    "targetRoleTitlesJson" JSONB NOT NULL DEFAULT '[]',
    "targetAudienceJson" JSONB NOT NULL DEFAULT '[]',
    "positioningStatement" TEXT,
    "professionalThemesJson" JSONB NOT NULL DEFAULT '[]',
    "contentTone" "LinkedinContentTone" NOT NULL DEFAULT 'PROFESSIONAL',
    "preferredLanguage" "LinkedinContentLanguage" NOT NULL DEFAULT 'ENGLISH',
    "postingFrequencyTarget" INTEGER,
    "visibilityGoal" TEXT,
    "recruiterGoal" TEXT,
    "networkGoal" TEXT,
    "profileSnapshotJson" JSONB,
    "status" "LinkedinGrowthStrategyStatus" NOT NULL DEFAULT 'DRAFT',
    "lastStrategyRefreshAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedinGrowthProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedinContentPillar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinGrowthProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goal" TEXT,
    "audience" TEXT,
    "priority" "LinkedinContentPillarPriority" NOT NULL DEFAULT 'SECONDARY',
    "evidenceSourcesJson" JSONB NOT NULL DEFAULT '[]',
    "exampleAnglesJson" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedinContentPillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedinContentIdea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinGrowthProfileId" TEXT NOT NULL,
    "pillarId" TEXT,
    "title" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "format" "LinkedinContentFormat" NOT NULL,
    "objective" "LinkedinPostObjective" NOT NULL,
    "audience" TEXT,
    "sourceContextJson" JSONB NOT NULL DEFAULT '{}',
    "evidenceJson" JSONB NOT NULL DEFAULT '[]',
    "evidenceStrength" "LinkedinEvidenceStrength" NOT NULL,
    "recruiterRelevance" "LinkedinRecruiterRelevance" NOT NULL DEFAULT 'MEDIUM',
    "timeliness" "LinkedinTimeliness" NOT NULL DEFAULT 'EVERGREEN',
    "expiresAt" TIMESTAMP(3),
    "priorityScore" INTEGER NOT NULL,
    "contextFingerprint" TEXT,
    "status" "LinkedinContentIdeaStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "linkedinContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedinPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinGrowthProfileId" TEXT NOT NULL,
    "contentIdeaId" TEXT,
    "pillarId" TEXT,
    "status" "LinkedinPostStatus" NOT NULL DEFAULT 'DRAFT',
    "activeRevisionId" TEXT,
    "objective" "LinkedinPostObjective" NOT NULL,
    "format" "LinkedinContentFormat" NOT NULL,
    "intendedAudience" TEXT,
    "plannedPublishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishingSource" "LinkedinPublishingSource",
    "externalLinkedInPostId" TEXT,
    "externalLinkedInUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "linkedinPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedinPostRevision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinPostId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "source" "LinkedinPostRevisionSource" NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "tone" "LinkedinContentTone" NOT NULL,
    "language" "LinkedinContentLanguage" NOT NULL,
    "hashtagsJson" JSONB NOT NULL DEFAULT '[]',
    "mentionsJson" JSONB NOT NULL DEFAULT '[]',
    "evidenceJson" JSONB NOT NULL DEFAULT '[]',
    "sourceContextSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "qaStatus" "LinkedinPostQaStatus",
    "qaFingerprint" TEXT,
    "generationStatus" "LinkedinPostGenerationStatus" NOT NULL DEFAULT 'COMPLETED',
    "aiSource" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linkedinPostRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedinPublishingPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinPostId" TEXT NOT NULL,
    "linkedinPostRevisionId" TEXT NOT NULL,
    "status" "LinkedinPublishingPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "publishMode" "LinkedinPublishMode" NOT NULL DEFAULT 'MANUAL',
    "plannedPublishAt" TIMESTAMP(3),
    "timezone" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "publishingSource" "LinkedinPublishingSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedinPublishingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedinPostPerformance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinPostId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER,
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "reposts" INTEGER,
    "saves" INTEGER,
    "profileViews" INTEGER,
    "newFollowers" INTEGER,
    "connectionRequests" INTEGER,
    "recruiterMessages" INTEGER,
    "source" "LinkedinPerformanceSource" NOT NULL DEFAULT 'USER_ENTERED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linkedinPostPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedinGrowthInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinGrowthProfileId" TEXT NOT NULL,
    "type" "LinkedinGrowthInsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL DEFAULT '{}',
    "confidence" TEXT NOT NULL,
    "status" "LinkedinGrowthInsightStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "linkedinGrowthInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linkedinGrowthProfile_userId_idx" ON "linkedinGrowthProfile"("userId");

-- CreateIndex
CREATE INDEX "linkedinGrowthProfile_userId_status_idx" ON "linkedinGrowthProfile"("userId", "status");

-- CreateIndex
CREATE INDEX "linkedinGrowthProfile_updatedAt_idx" ON "linkedinGrowthProfile"("updatedAt");

-- CreateIndex
CREATE INDEX "linkedinContentPillar_userId_idx" ON "linkedinContentPillar"("userId");

-- CreateIndex
CREATE INDEX "linkedinContentPillar_linkedinGrowthProfileId_idx" ON "linkedinContentPillar"("linkedinGrowthProfileId");

-- CreateIndex
CREATE INDEX "linkedinContentPillar_isActive_idx" ON "linkedinContentPillar"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "linkedinContentPillar_linkedinGrowthProfileId_slug_key" ON "linkedinContentPillar"("linkedinGrowthProfileId", "slug");

-- CreateIndex
CREATE INDEX "linkedinContentIdea_userId_idx" ON "linkedinContentIdea"("userId");

-- CreateIndex
CREATE INDEX "linkedinContentIdea_linkedinGrowthProfileId_idx" ON "linkedinContentIdea"("linkedinGrowthProfileId");

-- CreateIndex
CREATE INDEX "linkedinContentIdea_pillarId_idx" ON "linkedinContentIdea"("pillarId");

-- CreateIndex
CREATE INDEX "linkedinContentIdea_status_idx" ON "linkedinContentIdea"("status");

-- CreateIndex
CREATE INDEX "linkedinContentIdea_contextFingerprint_idx" ON "linkedinContentIdea"("contextFingerprint");

-- CreateIndex
CREATE INDEX "linkedinContentIdea_updatedAt_idx" ON "linkedinContentIdea"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "linkedinPost_activeRevisionId_key" ON "linkedinPost"("activeRevisionId");

-- CreateIndex
CREATE INDEX "linkedinPost_userId_idx" ON "linkedinPost"("userId");

-- CreateIndex
CREATE INDEX "linkedinPost_linkedinGrowthProfileId_idx" ON "linkedinPost"("linkedinGrowthProfileId");

-- CreateIndex
CREATE INDEX "linkedinPost_contentIdeaId_idx" ON "linkedinPost"("contentIdeaId");

-- CreateIndex
CREATE INDEX "linkedinPost_pillarId_idx" ON "linkedinPost"("pillarId");

-- CreateIndex
CREATE INDEX "linkedinPost_status_idx" ON "linkedinPost"("status");

-- CreateIndex
CREATE INDEX "linkedinPost_updatedAt_idx" ON "linkedinPost"("updatedAt");

-- CreateIndex
CREATE INDEX "linkedinPostRevision_userId_idx" ON "linkedinPostRevision"("userId");

-- CreateIndex
CREATE INDEX "linkedinPostRevision_linkedinPostId_idx" ON "linkedinPostRevision"("linkedinPostId");

-- CreateIndex
CREATE INDEX "linkedinPostRevision_createdAt_idx" ON "linkedinPostRevision"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "linkedinPostRevision_linkedinPostId_revisionNumber_key" ON "linkedinPostRevision"("linkedinPostId", "revisionNumber");

-- CreateIndex
CREATE INDEX "linkedinPublishingPlan_userId_idx" ON "linkedinPublishingPlan"("userId");

-- CreateIndex
CREATE INDEX "linkedinPublishingPlan_linkedinPostId_idx" ON "linkedinPublishingPlan"("linkedinPostId");

-- CreateIndex
CREATE INDEX "linkedinPublishingPlan_linkedinPostRevisionId_idx" ON "linkedinPublishingPlan"("linkedinPostRevisionId");

-- CreateIndex
CREATE INDEX "linkedinPublishingPlan_status_idx" ON "linkedinPublishingPlan"("status");

-- CreateIndex
CREATE INDEX "linkedinPublishingPlan_plannedPublishAt_idx" ON "linkedinPublishingPlan"("plannedPublishAt");

-- CreateIndex
CREATE INDEX "linkedinPostPerformance_userId_idx" ON "linkedinPostPerformance"("userId");

-- CreateIndex
CREATE INDEX "linkedinPostPerformance_linkedinPostId_idx" ON "linkedinPostPerformance"("linkedinPostId");

-- CreateIndex
CREATE INDEX "linkedinPostPerformance_capturedAt_idx" ON "linkedinPostPerformance"("capturedAt");

-- CreateIndex
CREATE INDEX "linkedinGrowthInsight_userId_idx" ON "linkedinGrowthInsight"("userId");

-- CreateIndex
CREATE INDEX "linkedinGrowthInsight_linkedinGrowthProfileId_idx" ON "linkedinGrowthInsight"("linkedinGrowthProfileId");

-- CreateIndex
CREATE INDEX "linkedinGrowthInsight_type_idx" ON "linkedinGrowthInsight"("type");

-- CreateIndex
CREATE INDEX "linkedinGrowthInsight_status_idx" ON "linkedinGrowthInsight"("status");

-- CreateIndex
CREATE INDEX "linkedinGrowthInsight_createdAt_idx" ON "linkedinGrowthInsight"("createdAt");

-- AddForeignKey
ALTER TABLE "linkedinGrowthProfile" ADD CONSTRAINT "linkedinGrowthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinContentPillar" ADD CONSTRAINT "linkedinContentPillar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinContentPillar" ADD CONSTRAINT "linkedinContentPillar_linkedinGrowthProfileId_fkey" FOREIGN KEY ("linkedinGrowthProfileId") REFERENCES "linkedinGrowthProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinContentIdea" ADD CONSTRAINT "linkedinContentIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinContentIdea" ADD CONSTRAINT "linkedinContentIdea_linkedinGrowthProfileId_fkey" FOREIGN KEY ("linkedinGrowthProfileId") REFERENCES "linkedinGrowthProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinContentIdea" ADD CONSTRAINT "linkedinContentIdea_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "linkedinContentPillar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPost" ADD CONSTRAINT "linkedinPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPost" ADD CONSTRAINT "linkedinPost_linkedinGrowthProfileId_fkey" FOREIGN KEY ("linkedinGrowthProfileId") REFERENCES "linkedinGrowthProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPost" ADD CONSTRAINT "linkedinPost_contentIdeaId_fkey" FOREIGN KEY ("contentIdeaId") REFERENCES "linkedinContentIdea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPost" ADD CONSTRAINT "linkedinPost_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "linkedinContentPillar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPost" ADD CONSTRAINT "linkedinPost_activeRevisionId_fkey" FOREIGN KEY ("activeRevisionId") REFERENCES "linkedinPostRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPostRevision" ADD CONSTRAINT "linkedinPostRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPostRevision" ADD CONSTRAINT "linkedinPostRevision_linkedinPostId_fkey" FOREIGN KEY ("linkedinPostId") REFERENCES "linkedinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPublishingPlan" ADD CONSTRAINT "linkedinPublishingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPublishingPlan" ADD CONSTRAINT "linkedinPublishingPlan_linkedinPostId_fkey" FOREIGN KEY ("linkedinPostId") REFERENCES "linkedinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPublishingPlan" ADD CONSTRAINT "linkedinPublishingPlan_linkedinPostRevisionId_fkey" FOREIGN KEY ("linkedinPostRevisionId") REFERENCES "linkedinPostRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPostPerformance" ADD CONSTRAINT "linkedinPostPerformance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPostPerformance" ADD CONSTRAINT "linkedinPostPerformance_linkedinPostId_fkey" FOREIGN KEY ("linkedinPostId") REFERENCES "linkedinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinGrowthInsight" ADD CONSTRAINT "linkedinGrowthInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinGrowthInsight" ADD CONSTRAINT "linkedinGrowthInsight_linkedinGrowthProfileId_fkey" FOREIGN KEY ("linkedinGrowthProfileId") REFERENCES "linkedinGrowthProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
