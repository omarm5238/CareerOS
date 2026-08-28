-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'APPLIED', 'SCREENING', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('JOBS_MODULE', 'MANUAL', 'IMPORTED', 'DISCOVERY_QUEUE');

-- CreateEnum
CREATE TYPE "ApplicationEventType" AS ENUM ('CREATED', 'SUBMITTED', 'STATUS_CHANGED', 'FOLLOW_UP_SCHEDULED', 'FOLLOW_UP_SENT', 'FOLLOW_UP_CLEARED', 'NOTE_ADDED', 'CONTACT_ADDED', 'CONTACT_UPDATED', 'SCREENING_SCHEDULED', 'SCREENING_COMPLETED', 'ASSESSMENT_RECEIVED', 'ASSESSMENT_SCHEDULED', 'ASSESSMENT_COMPLETED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'OFFER_RECEIVED', 'REJECTION_RECORDED', 'WITHDRAWN', 'RESUME_LINKED', 'NEXT_ACTION_UPDATED', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationEventSource" AS ENUM ('USER', 'SYSTEM', 'AI', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ApplicationInsightType" AS ENUM ('NEXT_ACTION', 'SCREENING_PREP', 'ASSESSMENT_PREP', 'INTERVIEW_PREP', 'OFFER_REVIEW', 'REJECTION_ANALYSIS');

-- CreateEnum
CREATE TYPE "ApplicationInsightSource" AS ENUM ('AI_GENERATED', 'RULE_BASED_FALLBACK');

-- CreateEnum
CREATE TYPE "ApplicationNextActionType" AS ENUM ('SUBMIT_APPLICATION', 'FOLLOW_UP', 'CONTACT_RECRUITER', 'PREPARE_SCREENING', 'PREPARE_ASSESSMENT', 'PREPARE_INTERVIEW', 'REVIEW_OFFER', 'PROVIDE_DOCUMENTS', 'UPDATE_RESUME', 'BUILD_SKILL', 'WAIT', 'REVIEW_REJECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationNextActionSource" AS ENUM ('USER', 'RULE_BASED', 'AI');

-- CreateEnum
CREATE TYPE "ApplicationRejectionSource" AS ENUM ('EMPLOYER_STATED', 'USER_CONFIRMED_FACT', 'OTHER_CONFIRMED');

-- CreateTable
CREATE TABLE "application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostingId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "ApplicationSource" NOT NULL DEFAULT 'JOBS_MODULE',
    "resumeVersionId" TEXT,
    "resumeVersionRevisionId" TEXT,
    "contextSnapshotJson" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextActionType" "ApplicationNextActionType",
    "nextActionTitle" TEXT,
    "nextActionReason" TEXT,
    "nextActionDueAt" TIMESTAMP(3),
    "nextActionSource" "ApplicationNextActionSource",
    "notes" TEXT,
    "companyNotes" TEXT,
    "salaryNotes" TEXT,
    "documentsNeededJson" JSONB NOT NULL DEFAULT '[]',
    "confirmedRejectionReason" TEXT,
    "confirmedRejectionSource" "ApplicationRejectionSource",
    "rejectedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ApplicationEventType" NOT NULL,
    "source" "ApplicationEventSource" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus",
    "eventAt" TIMESTAMP(3) NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationContact" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicationContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationInsight" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ApplicationInsightType" NOT NULL,
    "source" "ApplicationInsightSource" NOT NULL DEFAULT 'RULE_BASED_FALLBACK',
    "contentJson" JSONB NOT NULL,
    "contextSnapshotJson" JSONB NOT NULL,
    "contextFingerprint" TEXT,
    "model" TEXT,
    "aiSource" TEXT,
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicationInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_userId_idx" ON "application"("userId");

-- CreateIndex
CREATE INDEX "application_jobPostingId_idx" ON "application"("jobPostingId");

-- CreateIndex
CREATE INDEX "application_status_idx" ON "application"("status");

-- CreateIndex
CREATE INDEX "application_followUpAt_idx" ON "application"("followUpAt");

-- CreateIndex
CREATE INDEX "application_nextActionDueAt_idx" ON "application"("nextActionDueAt");

-- CreateIndex
CREATE INDEX "application_lastActivityAt_idx" ON "application"("lastActivityAt");

-- CreateIndex
CREATE INDEX "application_updatedAt_idx" ON "application"("updatedAt");

-- CreateIndex
CREATE INDEX "applicationEvent_userId_idx" ON "applicationEvent"("userId");

-- CreateIndex
CREATE INDEX "applicationEvent_applicationId_idx" ON "applicationEvent"("applicationId");

-- CreateIndex
CREATE INDEX "applicationEvent_type_idx" ON "applicationEvent"("type");

-- CreateIndex
CREATE INDEX "applicationEvent_eventAt_idx" ON "applicationEvent"("eventAt");

-- CreateIndex
CREATE INDEX "applicationEvent_applicationId_eventAt_idx" ON "applicationEvent"("applicationId", "eventAt");

-- CreateIndex
CREATE INDEX "applicationContact_userId_idx" ON "applicationContact"("userId");

-- CreateIndex
CREATE INDEX "applicationContact_applicationId_idx" ON "applicationContact"("applicationId");

-- CreateIndex
CREATE INDEX "applicationInsight_userId_idx" ON "applicationInsight"("userId");

-- CreateIndex
CREATE INDEX "applicationInsight_applicationId_idx" ON "applicationInsight"("applicationId");

-- CreateIndex
CREATE INDEX "applicationInsight_type_idx" ON "applicationInsight"("type");

-- CreateIndex
CREATE INDEX "applicationInsight_createdAt_idx" ON "applicationInsight"("createdAt");

-- CreateIndex
CREATE INDEX "applicationInsight_applicationId_type_contextFingerprint_idx" ON "applicationInsight"("applicationId", "type", "contextFingerprint");

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "jobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "resumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_resumeVersionRevisionId_fkey" FOREIGN KEY ("resumeVersionRevisionId") REFERENCES "resumeVersionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationEvent" ADD CONSTRAINT "applicationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationEvent" ADD CONSTRAINT "applicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationContact" ADD CONSTRAINT "applicationContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationContact" ADD CONSTRAINT "applicationContact_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationInsight" ADD CONSTRAINT "applicationInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationInsight" ADD CONSTRAINT "applicationInsight_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
