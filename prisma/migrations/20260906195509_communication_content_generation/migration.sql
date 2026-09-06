-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('COVER_LETTER', 'APPLICATION_EMAIL', 'RECRUITER_OUTREACH', 'FOLLOW_UP', 'INTERVIEW_THANK_YOU', 'POST_INTERVIEW_FOLLOW_UP', 'OFFER_RESPONSE', 'GENERAL_PROFESSIONAL_MESSAGE');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'READY', 'USED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunicationTone" AS ENUM ('PROFESSIONAL', 'WARM', 'CONCISE', 'CONFIDENT', 'FORMAL');

-- CreateEnum
CREATE TYPE "CommunicationLength" AS ENUM ('SHORT', 'STANDARD', 'DETAILED');

-- CreateEnum
CREATE TYPE "CommunicationLanguage" AS ENUM ('ENGLISH', 'ARABIC', 'TURKISH');

-- CreateEnum
CREATE TYPE "CommunicationRevisionSource" AS ENUM ('AI_GENERATED', 'USER_EDITED', 'RULE_BASED_FALLBACK');

-- CreateEnum
CREATE TYPE "CommunicationGenerationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "communicationDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "jobPostingId" TEXT,
    "contactId" TEXT,
    "resumeVersionId" TEXT,
    "resumeVersionRevisionId" TEXT,
    "type" "CommunicationType" NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'DRAFT',
    "activeRevisionId" TEXT,
    "usedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communicationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communicationDraftRevision" (
    "id" TEXT NOT NULL,
    "communicationDraftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "source" "CommunicationRevisionSource" NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "tone" "CommunicationTone" NOT NULL,
    "length" "CommunicationLength" NOT NULL,
    "language" "CommunicationLanguage" NOT NULL,
    "contextSnapshotJson" JSONB NOT NULL,
    "contextFingerprint" TEXT NOT NULL,
    "evidenceUsedJson" JSONB NOT NULL DEFAULT '[]',
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "changeLogJson" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "aiSource" TEXT,
    "generationStatus" "CommunicationGenerationStatus" NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communicationDraftRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communicationDraft_activeRevisionId_key" ON "communicationDraft"("activeRevisionId");

-- CreateIndex
CREATE INDEX "communicationDraft_userId_idx" ON "communicationDraft"("userId");

-- CreateIndex
CREATE INDEX "communicationDraft_applicationId_idx" ON "communicationDraft"("applicationId");

-- CreateIndex
CREATE INDEX "communicationDraft_jobPostingId_idx" ON "communicationDraft"("jobPostingId");

-- CreateIndex
CREATE INDEX "communicationDraft_contactId_idx" ON "communicationDraft"("contactId");

-- CreateIndex
CREATE INDEX "communicationDraft_type_idx" ON "communicationDraft"("type");

-- CreateIndex
CREATE INDEX "communicationDraft_status_idx" ON "communicationDraft"("status");

-- CreateIndex
CREATE INDEX "communicationDraft_updatedAt_idx" ON "communicationDraft"("updatedAt");

-- CreateIndex
CREATE INDEX "communicationDraftRevision_userId_idx" ON "communicationDraftRevision"("userId");

-- CreateIndex
CREATE INDEX "communicationDraftRevision_communicationDraftId_idx" ON "communicationDraftRevision"("communicationDraftId");

-- CreateIndex
CREATE INDEX "communicationDraftRevision_createdAt_idx" ON "communicationDraftRevision"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "communicationDraftRevision_communicationDraftId_revisionNum_key" ON "communicationDraftRevision"("communicationDraftId", "revisionNumber");

-- AddForeignKey
ALTER TABLE "communicationDraft" ADD CONSTRAINT "communicationDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communicationDraft" ADD CONSTRAINT "communicationDraft_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communicationDraft" ADD CONSTRAINT "communicationDraft_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "jobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communicationDraft" ADD CONSTRAINT "communicationDraft_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "applicationContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communicationDraft" ADD CONSTRAINT "communicationDraft_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "resumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communicationDraft" ADD CONSTRAINT "communicationDraft_resumeVersionRevisionId_fkey" FOREIGN KEY ("resumeVersionRevisionId") REFERENCES "resumeVersionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communicationDraft" ADD CONSTRAINT "communicationDraft_activeRevisionId_fkey" FOREIGN KEY ("activeRevisionId") REFERENCES "communicationDraftRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communicationDraftRevision" ADD CONSTRAINT "communicationDraftRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communicationDraftRevision" ADD CONSTRAINT "communicationDraftRevision_communicationDraftId_fkey" FOREIGN KEY ("communicationDraftId") REFERENCES "communicationDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
