-- CreateEnum
CREATE TYPE "DailyRoadmapStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DailyRoadmapGenerationSource" AS ENUM ('DETERMINISTIC', 'AI_ASSISTED', 'FALLBACK');

-- CreateEnum
CREATE TYPE "DailyRoadmapActionType" AS ENUM ('JOB_REVIEW', 'JOB_PREPARE', 'JOB_APPLY', 'APPLICATION_FOLLOW_UP', 'APPLICATION_NEXT_STEP', 'INTERVIEW_PREP', 'ASSESSMENT_PREP', 'RESUME_REVIEW', 'COMMUNICATION_REVIEW', 'LINKEDIN_POST_REVIEW', 'LINKEDIN_PUBLISH', 'LINKEDIN_ANALYTICS_REVIEW', 'LINKEDIN_RECONNECT', 'SKILL_DEVELOPMENT', 'EVIDENCE_BUILDING', 'PROFILE_IMPROVEMENT', 'WEEKLY_PREP', 'CUSTOM_CAREER_ACTION');

-- CreateEnum
CREATE TYPE "DailyRoadmapActionOrigin" AS ENUM ('SYSTEM_GENERATED', 'USER_CREATED', 'SYSTEM_RECOMMENDED', 'CARRIED_OVER');

-- CreateEnum
CREATE TYPE "DailyRoadmapSourceEntityType" AS ENUM ('JOB', 'APPLICATION', 'RESUME_VERSION', 'COMMUNICATION', 'LINKEDIN_POST', 'LINKEDIN_PLAN', 'SKILL', 'PROJECT', 'CAREER_CONTEXT', 'NONE');

-- CreateEnum
CREATE TYPE "DailyRoadmapActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'DEFERRED', 'EXPIRED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DailyRoadmapCompletionSource" AS ENUM ('USER_CONFIRMED', 'DOMAIN_EVENT', 'SYSTEM_RECONCILED');

-- CreateEnum
CREATE TYPE "DailyRoadmapPriorityBand" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "CareerActivityType" AS ENUM ('APPLICATION_SUBMITTED', 'RESUME_READY', 'COMMUNICATION_USED', 'LINKEDIN_PUBLISHED', 'ROADMAP_ACTION_COMPLETED', 'SKILL_ACTION_COMPLETED', 'EVIDENCE_ACTION_COMPLETED', 'INTERVIEW_PREP_COMPLETED', 'ASSESSMENT_PREP_COMPLETED');

-- CreateTable
CREATE TABLE "dailyRoadmapPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dailyMinutesTarget" INTEGER NOT NULL DEFAULT 60,
    "maxCoreActions" INTEGER NOT NULL DEFAULT 4,
    "activeWeekdaysJson" JSONB NOT NULL DEFAULT '["MON","TUE","WED","THU","FRI"]',
    "includeLinkedIn" BOOLEAN NOT NULL DEFAULT true,
    "includeSkillDevelopment" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dailyRoadmapPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dailyRoadmap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "DailyRoadmapStatus" NOT NULL DEFAULT 'ACTIVE',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3),
    "plannedMinutes" INTEGER NOT NULL,
    "contextFingerprint" TEXT NOT NULL,
    "generationSource" "DailyRoadmapGenerationSource" NOT NULL DEFAULT 'DETERMINISTIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dailyRoadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dailyRoadmapAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyRoadmapId" TEXT NOT NULL,
    "type" "DailyRoadmapActionType" NOT NULL,
    "origin" "DailyRoadmapActionOrigin" NOT NULL,
    "sourceEntityType" "DailyRoadmapSourceEntityType" NOT NULL,
    "sourceEntityId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "whyNow" TEXT,
    "priorityScore" INTEGER NOT NULL,
    "priorityBand" "DailyRoadmapPriorityBand" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "status" "DailyRoadmapActionStatus" NOT NULL DEFAULT 'PLANNED',
    "isMeaningful" BOOLEAN NOT NULL DEFAULT false,
    "isActionable" BOOLEAN NOT NULL DEFAULT true,
    "blockedReason" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "deferredUntil" TEXT,
    "completedAt" TIMESTAMP(3),
    "completionSource" "DailyRoadmapCompletionSource",
    "deepLink" TEXT,
    "contextSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dailyRoadmapAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careerActivityRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "activityType" "CareerActivityType" NOT NULL,
    "sourceEntityType" "DailyRoadmapSourceEntityType" NOT NULL,
    "sourceEntityId" TEXT,
    "meaningful" BOOLEAN NOT NULL DEFAULT true,
    "minutes" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "careerActivityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careerActivityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "meaningfulActionCount" INTEGER NOT NULL DEFAULT 0,
    "completedActionCount" INTEGER NOT NULL DEFAULT 0,
    "plannedActionCount" INTEGER NOT NULL DEFAULT 0,
    "completedMinutes" INTEGER,
    "qualifiesForStreak" BOOLEAN NOT NULL DEFAULT false,
    "firstMeaningfulActivityAt" TIMESTAMP(3),
    "lastMeaningfulActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "careerActivityDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dailyRoadmapPreference_userId_key" ON "dailyRoadmapPreference"("userId");

-- CreateIndex
CREATE INDEX "dailyRoadmapPreference_userId_idx" ON "dailyRoadmapPreference"("userId");

-- CreateIndex
CREATE INDEX "dailyRoadmap_userId_idx" ON "dailyRoadmap"("userId");

-- CreateIndex
CREATE INDEX "dailyRoadmap_localDate_idx" ON "dailyRoadmap"("localDate");

-- CreateIndex
CREATE INDEX "dailyRoadmap_status_idx" ON "dailyRoadmap"("status");

-- CreateIndex
CREATE UNIQUE INDEX "dailyRoadmap_userId_localDate_key" ON "dailyRoadmap"("userId", "localDate");

-- CreateIndex
CREATE INDEX "dailyRoadmapAction_userId_idx" ON "dailyRoadmapAction"("userId");

-- CreateIndex
CREATE INDEX "dailyRoadmapAction_dailyRoadmapId_idx" ON "dailyRoadmapAction"("dailyRoadmapId");

-- CreateIndex
CREATE INDEX "dailyRoadmapAction_status_idx" ON "dailyRoadmapAction"("status");

-- CreateIndex
CREATE INDEX "dailyRoadmapAction_type_idx" ON "dailyRoadmapAction"("type");

-- CreateIndex
CREATE INDEX "dailyRoadmapAction_sourceEntityType_sourceEntityId_idx" ON "dailyRoadmapAction"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "dailyRoadmapAction_dailyRoadmapId_fingerprint_key" ON "dailyRoadmapAction"("dailyRoadmapId", "fingerprint");

-- CreateIndex
CREATE INDEX "careerActivityRecord_userId_idx" ON "careerActivityRecord"("userId");

-- CreateIndex
CREATE INDEX "careerActivityRecord_localDate_idx" ON "careerActivityRecord"("localDate");

-- CreateIndex
CREATE INDEX "careerActivityRecord_activityType_idx" ON "careerActivityRecord"("activityType");

-- CreateIndex
CREATE INDEX "careerActivityRecord_occurredAt_idx" ON "careerActivityRecord"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "careerActivityRecord_userId_fingerprint_key" ON "careerActivityRecord"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "careerActivityDay_userId_idx" ON "careerActivityDay"("userId");

-- CreateIndex
CREATE INDEX "careerActivityDay_localDate_idx" ON "careerActivityDay"("localDate");

-- CreateIndex
CREATE INDEX "careerActivityDay_qualifiesForStreak_idx" ON "careerActivityDay"("qualifiesForStreak");

-- CreateIndex
CREATE UNIQUE INDEX "careerActivityDay_userId_localDate_key" ON "careerActivityDay"("userId", "localDate");

-- AddForeignKey
ALTER TABLE "dailyRoadmapPreference" ADD CONSTRAINT "dailyRoadmapPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dailyRoadmap" ADD CONSTRAINT "dailyRoadmap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dailyRoadmapAction" ADD CONSTRAINT "dailyRoadmapAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dailyRoadmapAction" ADD CONSTRAINT "dailyRoadmapAction_dailyRoadmapId_fkey" FOREIGN KEY ("dailyRoadmapId") REFERENCES "dailyRoadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerActivityRecord" ADD CONSTRAINT "careerActivityRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerActivityDay" ADD CONSTRAINT "careerActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
