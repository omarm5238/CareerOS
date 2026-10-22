-- AlterEnum
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'SUBMIT_AUTHORIZATION_ISSUED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'SUBMIT_BOUNDARY_ACQUIRED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'CLICK_ATTEMPT_STARTED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'CLICK_DISPATCHED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'POST_CLICK_NAVIGATION_OBSERVED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'POST_CLICK_NETWORK_OBSERVED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'POST_CLICK_DOM_OBSERVED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'CONFIRMATION_EVIDENCE_OBSERVED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'CONFIRMATION_EVIDENCE_REJECTED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'CONFIRMATION_PERSISTED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'PROVIDER_VERIFICATION_STARTED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'PROVIDER_VERIFICATION_CONFIRMED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'PROVIDER_VERIFICATION_NOT_FOUND';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'PROVIDER_VERIFICATION_INCONCLUSIVE';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'SUBMISSION_MARKED_UNCERTAIN';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'MANUAL_CONFIRMATION_RECORDED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'MANUAL_NOT_SUBMITTED_RECORDED';
ALTER TYPE "ApplicationExecutionEventType" ADD VALUE 'LOCAL_RECONCILIATION_COMPLETED';

-- CreateEnum
CREATE TYPE "SubmitAuthorizationState" AS ENUM ('ISSUED', 'CONSUMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ExternalSubmissionPhase" AS ENUM ('EXECUTION_STARTED', 'FORM_READY', 'SUBMIT_BOUNDARY_ACQUIRED', 'CLICK_ATTEMPT_STARTED', 'CLICK_DISPATCHED', 'POST_CLICK_ACTIVITY_OBSERVED', 'CONFIRMATION_OBSERVED', 'CONFIRMATION_PERSISTED', 'LOCAL_FINALIZATION_COMPLETED', 'PROVIDER_REJECTED', 'USER_ABORTED', 'FAILED_BEFORE_CLICK');

-- CreateEnum
CREATE TYPE "RecoveryDisposition" AS ENUM ('SAFE_TO_RETRY', 'VERIFY_PROVIDER', 'SUBMIT_UNCERTAIN', 'CONFIRMED_NEEDS_LOCAL_RECONCILIATION', 'ALREADY_FINALIZED', 'MANUAL_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "ConfirmationStrength" AS ENUM ('NONE', 'WEAK', 'STRONG', 'DEFINITIVE');

-- AlterTable
ALTER TABLE "applicationSubmissionAttempt" ADD COLUMN "externalPhase" "ExternalSubmissionPhase",
ADD COLUMN "recoveryDisposition" "RecoveryDisposition",
ADD COLUMN "confirmationStrength" "ConfirmationStrength",
ADD COLUMN "clickAttemptStartedAt" TIMESTAMP(3),
ADD COLUMN "clickDispatchedAt" TIMESTAMP(3),
ADD COLUMN "postClickActivityObservedAt" TIMESTAMP(3),
ADD COLUMN "confirmationObservedAt" TIMESTAMP(3),
ADD COLUMN "confirmationPersistedAt" TIMESTAMP(3),
ADD COLUMN "providerAdapterVersion" TEXT,
ADD COLUMN "selectorStrategyVersion" TEXT,
ADD COLUMN "confirmationStrategyVersion" TEXT,
ADD COLUMN "lastProviderVerificationAt" TIMESTAMP(3),
ADD COLUMN "submitAuthorizationId" TEXT;

-- CreateTable
CREATE TABLE "applicationSubmitAuthorization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "provider" "ApplicationProvider" NOT NULL,
    "targetHost" TEXT NOT NULL,
    "targetJobId" TEXT,
    "authorizationHash" TEXT NOT NULL,
    "state" "SubmitAuthorizationState" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "dryRunStatus" TEXT,
    "dryRunCertifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicationSubmitAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applicationSubmissionAttempt_submitAuthorizationId_key" ON "applicationSubmissionAttempt"("submitAuthorizationId");

-- CreateIndex
CREATE UNIQUE INDEX "applicationSubmitAuthorization_attemptId_key" ON "applicationSubmitAuthorization"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "applicationSubmitAuthorization_authorizationHash_key" ON "applicationSubmitAuthorization"("authorizationHash");

-- CreateIndex
CREATE INDEX "applicationSubmitAuthorization_userId_idx" ON "applicationSubmitAuthorization"("userId");

-- CreateIndex
CREATE INDEX "applicationSubmitAuthorization_applicationId_idx" ON "applicationSubmitAuthorization"("applicationId");

-- CreateIndex
CREATE INDEX "applicationSubmitAuthorization_packageId_idx" ON "applicationSubmitAuthorization"("packageId");

-- CreateIndex
CREATE INDEX "applicationSubmitAuthorization_state_idx" ON "applicationSubmitAuthorization"("state");

-- AddForeignKey
ALTER TABLE "applicationSubmitAuthorization" ADD CONSTRAINT "applicationSubmitAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationSubmitAuthorization" ADD CONSTRAINT "applicationSubmitAuthorization_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationSubmitAuthorization" ADD CONSTRAINT "applicationSubmitAuthorization_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "applicationPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationSubmitAuthorization" ADD CONSTRAINT "applicationSubmitAuthorization_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "applicationSubmissionAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
