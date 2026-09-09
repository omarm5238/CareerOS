-- CreateEnum
CREATE TYPE "ApplicationProvider" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'WORKABLE', 'SMARTRECRUITERS', 'GENERIC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ApplicationExecutionMode" AS ENUM ('MANUAL_EXTERNAL', 'ASSISTED_BROWSER', 'CONFIRMED_BROWSER_SUBMIT', 'OFFICIAL_API');

-- CreateEnum
CREATE TYPE "ApplicationExecutionStatus" AS ENUM ('CREATED', 'DETECTING_ATS', 'INSPECTING', 'READY_TO_FILL', 'FILLING', 'NEEDS_USER_INPUT', 'PAUSED_FOR_LOGIN', 'PAUSED_FOR_MFA', 'PAUSED_FOR_CAPTCHA', 'PAUSED_FOR_ASSESSMENT', 'READY_FOR_REVIEW', 'READY_TO_SUBMIT', 'SUBMITTING', 'VERIFYING', 'SUBMITTED', 'INTERRUPTED', 'FAILED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationExecutionEventType" AS ENUM ('SESSION_CREATED', 'BROWSER_STARTED', 'ATS_DETECTED', 'FORM_INSPECTED', 'FILL_PLAN_BUILT', 'FIELD_FILLED', 'FIELD_PROPOSED', 'FILE_UPLOADED', 'USER_INPUT_REQUIRED', 'LOGIN_REQUIRED', 'MFA_REQUIRED', 'CAPTCHA_REQUIRED', 'ASSESSMENT_REQUIRED', 'UNSUPPORTED_WIDGET', 'STEP_VALIDATED', 'STEP_ADVANCED', 'VALIDATION_ERROR', 'ADAPTER_FALLBACK', 'READY_FOR_REVIEW', 'READY_FOR_SUBMIT', 'SUBMISSION_APPROVED', 'SUBMIT_STARTED', 'SUBMIT_RESPONSE', 'VERIFICATION_RESULT', 'SESSION_INTERRUPTED', 'SESSION_FAILED', 'SESSION_CANCELLED', 'SESSION_COMPLETED');

-- CreateEnum
CREATE TYPE "ApplicationSubmissionMethod" AS ENUM ('USER_MANUAL', 'BROWSER_CONFIRMED', 'OFFICIAL_API');

-- CreateEnum
CREATE TYPE "ApplicationSubmissionAttemptStatus" AS ENUM ('APPROVAL_GRANTED', 'SUBMITTING', 'VERIFYING', 'COMPLETED', 'FAILED', 'UNCERTAIN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationSubmissionVerificationStatus" AS ENUM ('NOT_RUN', 'VERIFIED', 'PROBABLE', 'UNVERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApplicationAnswerScope" AS ENUM ('GLOBAL', 'COUNTRY', 'PROVIDER', 'JOB_SPECIFIC');

-- CreateEnum
CREATE TYPE "ApplicationExecutionFailureCode" AS ENUM ('ATS_UNSUPPORTED', 'ADAPTER_DRIFT', 'LOGIN_REQUIRED', 'MFA_REQUIRED', 'CAPTCHA_REQUIRED', 'ASSESSMENT_REQUIRED', 'USER_INPUT_REQUIRED', 'CONSENT_REQUIRED', 'UNKNOWN_FIELD', 'UNSUPPORTED_WIDGET', 'VALIDATION_FAILED', 'RESUME_UPLOAD_FAILED', 'COVER_LETTER_UPLOAD_FAILED', 'NETWORK_ERROR', 'RATE_LIMITED', 'NAVIGATION_TIMEOUT', 'SESSION_EXPIRED', 'JOB_CLOSED', 'DUPLICATE_APPLICATION', 'SUBMISSION_REJECTED', 'SUBMISSION_UNCERTAIN', 'BROWSER_CRASHED');

-- CreateTable
CREATE TABLE "applicationExecutionSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationPackageId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "provider" "ApplicationProvider" NOT NULL DEFAULT 'UNKNOWN',
    "adapterVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "executionMode" "ApplicationExecutionMode" NOT NULL DEFAULT 'ASSISTED_BROWSER',
    "status" "ApplicationExecutionStatus" NOT NULL DEFAULT 'CREATED',
    "currentUrl" TEXT,
    "currentStep" INTEGER,
    "totalSteps" INTEGER,
    "formFingerprint" TEXT,
    "formSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "fillPlanJson" JSONB NOT NULL DEFAULT '{}',
    "pendingActionsJson" JSONB NOT NULL DEFAULT '[]',
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "failureCode" "ApplicationExecutionFailureCode",
    "failureMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicationExecutionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationExecutionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "executionSessionId" TEXT NOT NULL,
    "type" "ApplicationExecutionEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicationExecutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationSubmissionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "executionSessionId" TEXT NOT NULL,
    "applicationPackageId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "method" "ApplicationSubmissionMethod" NOT NULL,
    "status" "ApplicationSubmissionAttemptStatus" NOT NULL DEFAULT 'APPROVAL_GRANTED',
    "verificationStatus" "ApplicationSubmissionVerificationStatus" NOT NULL DEFAULT 'NOT_RUN',
    "approvalFingerprint" TEXT NOT NULL,
    "approvalTokenHash" TEXT,
    "approvalExpiresAt" TIMESTAMP(3),
    "approvalUsedAt" TIMESTAMP(3),
    "finalSubmissionSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "providerApplicationId" TEXT,
    "confirmationUrl" TEXT,
    "verificationEvidenceJson" JSONB NOT NULL DEFAULT '{}',
    "failureCode" "ApplicationExecutionFailureCode",
    "failureMessage" TEXT,
    "resumeVersionRevisionId" TEXT NOT NULL,
    "resumeFileHash" TEXT NOT NULL,
    "coverLetterRevisionId" TEXT,
    "coverLetterFileHash" TEXT,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicationSubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationAnswerPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scopeType" "ApplicationAnswerScope" NOT NULL,
    "scopeValue" TEXT NOT NULL DEFAULT '',
    "valueJson" JSONB NOT NULL,
    "requiresPerApplicationConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicationAnswerPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applicationExecutionSession_userId_idx" ON "applicationExecutionSession"("userId");

-- CreateIndex
CREATE INDEX "applicationExecutionSession_applicationPackageId_idx" ON "applicationExecutionSession"("applicationPackageId");

-- CreateIndex
CREATE INDEX "applicationExecutionSession_applicationId_idx" ON "applicationExecutionSession"("applicationId");

-- CreateIndex
CREATE INDEX "applicationExecutionSession_jobPostingId_idx" ON "applicationExecutionSession"("jobPostingId");

-- CreateIndex
CREATE INDEX "applicationExecutionSession_status_idx" ON "applicationExecutionSession"("status");

-- CreateIndex
CREATE INDEX "applicationExecutionSession_updatedAt_idx" ON "applicationExecutionSession"("updatedAt");

-- CreateIndex
CREATE INDEX "applicationExecutionEvent_userId_idx" ON "applicationExecutionEvent"("userId");

-- CreateIndex
CREATE INDEX "applicationExecutionEvent_executionSessionId_idx" ON "applicationExecutionEvent"("executionSessionId");

-- CreateIndex
CREATE INDEX "applicationExecutionEvent_createdAt_idx" ON "applicationExecutionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "applicationExecutionEvent_executionSessionId_createdAt_idx" ON "applicationExecutionEvent"("executionSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "applicationSubmissionAttempt_userId_idx" ON "applicationSubmissionAttempt"("userId");

-- CreateIndex
CREATE INDEX "applicationSubmissionAttempt_applicationPackageId_idx" ON "applicationSubmissionAttempt"("applicationPackageId");

-- CreateIndex
CREATE INDEX "applicationSubmissionAttempt_applicationId_idx" ON "applicationSubmissionAttempt"("applicationId");

-- CreateIndex
CREATE INDEX "applicationSubmissionAttempt_status_idx" ON "applicationSubmissionAttempt"("status");

-- CreateIndex
CREATE INDEX "applicationSubmissionAttempt_createdAt_idx" ON "applicationSubmissionAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "applicationSubmissionAttempt_executionSessionId_attemptNumb_key" ON "applicationSubmissionAttempt"("executionSessionId", "attemptNumber");

-- CreateIndex
CREATE INDEX "applicationAnswerPreference_userId_idx" ON "applicationAnswerPreference"("userId");

-- CreateIndex
CREATE INDEX "applicationAnswerPreference_key_idx" ON "applicationAnswerPreference"("key");

-- CreateIndex
CREATE INDEX "applicationAnswerPreference_expiresAt_idx" ON "applicationAnswerPreference"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "applicationAnswerPreference_userId_key_scopeType_scopeValue_key" ON "applicationAnswerPreference"("userId", "key", "scopeType", "scopeValue");

-- AddForeignKey
ALTER TABLE "applicationExecutionSession" ADD CONSTRAINT "applicationExecutionSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationExecutionSession" ADD CONSTRAINT "applicationExecutionSession_applicationPackageId_fkey" FOREIGN KEY ("applicationPackageId") REFERENCES "applicationPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationExecutionSession" ADD CONSTRAINT "applicationExecutionSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationExecutionSession" ADD CONSTRAINT "applicationExecutionSession_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "jobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationExecutionEvent" ADD CONSTRAINT "applicationExecutionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationExecutionEvent" ADD CONSTRAINT "applicationExecutionEvent_executionSessionId_fkey" FOREIGN KEY ("executionSessionId") REFERENCES "applicationExecutionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationSubmissionAttempt" ADD CONSTRAINT "applicationSubmissionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationSubmissionAttempt" ADD CONSTRAINT "applicationSubmissionAttempt_executionSessionId_fkey" FOREIGN KEY ("executionSessionId") REFERENCES "applicationExecutionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationSubmissionAttempt" ADD CONSTRAINT "applicationSubmissionAttempt_applicationPackageId_fkey" FOREIGN KEY ("applicationPackageId") REFERENCES "applicationPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationSubmissionAttempt" ADD CONSTRAINT "applicationSubmissionAttempt_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationSubmissionAttempt" ADD CONSTRAINT "applicationSubmissionAttempt_resumeVersionRevisionId_fkey" FOREIGN KEY ("resumeVersionRevisionId") REFERENCES "resumeVersionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationSubmissionAttempt" ADD CONSTRAINT "applicationSubmissionAttempt_coverLetterRevisionId_fkey" FOREIGN KEY ("coverLetterRevisionId") REFERENCES "communicationDraftRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationAnswerPreference" ADD CONSTRAINT "applicationAnswerPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
