-- CreateEnum
CREATE TYPE "LinkedinConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'REAUTH_REQUIRED', 'CONNECTION_ERROR', 'DISCONNECTING');

-- CreateEnum
CREATE TYPE "LinkedinPublishingAttemptStatus" AS ENUM ('CREATED', 'VALIDATING', 'READY_TO_PUBLISH', 'SUBMITTING', 'VERIFYING', 'PUBLISHED', 'FAILED', 'UNCERTAIN', 'CANCELLED');

-- CreateTable
CREATE TABLE "linkedinConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerSubject" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "profileImageUrl" TEXT,
    "status" "LinkedinConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "encryptedAccessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "grantedScopesJson" JSONB NOT NULL DEFAULT '[]',
    "capabilitySnapshotJson" JSONB,
    "connectedAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "reauthRequiredAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedinConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedinOAuthAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "pkceVerifierEncrypted" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linkedinOAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedinPublishingAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinConnectionId" TEXT,
    "linkedinPublishingPlanId" TEXT NOT NULL,
    "linkedinPostId" TEXT NOT NULL,
    "linkedinPostRevisionId" TEXT NOT NULL,
    "status" "LinkedinPublishingAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "contentFingerprint" TEXT NOT NULL,
    "capabilitySnapshotJson" JSONB,
    "providerRequestId" TEXT,
    "externalLinkedInPostId" TEXT,
    "externalLinkedInUrl" TEXT,
    "errorCode" TEXT,
    "providerErrorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedinPublishingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linkedinConnection_status_idx" ON "linkedinConnection"("status");

-- CreateIndex
CREATE INDEX "linkedinConnection_providerSubject_idx" ON "linkedinConnection"("providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "linkedinConnection_userId_key" ON "linkedinConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "linkedinOAuthAttempt_stateHash_key" ON "linkedinOAuthAttempt"("stateHash");

-- CreateIndex
CREATE INDEX "linkedinOAuthAttempt_userId_idx" ON "linkedinOAuthAttempt"("userId");

-- CreateIndex
CREATE INDEX "linkedinOAuthAttempt_expiresAt_idx" ON "linkedinOAuthAttempt"("expiresAt");

-- CreateIndex
CREATE INDEX "linkedinPublishingAttempt_userId_idx" ON "linkedinPublishingAttempt"("userId");

-- CreateIndex
CREATE INDEX "linkedinPublishingAttempt_linkedinPublishingPlanId_status_idx" ON "linkedinPublishingAttempt"("linkedinPublishingPlanId", "status");

-- CreateIndex
CREATE INDEX "linkedinPublishingAttempt_linkedinPostId_idx" ON "linkedinPublishingAttempt"("linkedinPostId");

-- CreateIndex
CREATE INDEX "linkedinPublishingAttempt_linkedinPostRevisionId_idx" ON "linkedinPublishingAttempt"("linkedinPostRevisionId");

-- CreateIndex
CREATE INDEX "linkedinPublishingAttempt_linkedinConnectionId_idx" ON "linkedinPublishingAttempt"("linkedinConnectionId");

-- CreateIndex
CREATE INDEX "linkedinPublishingAttempt_createdAt_idx" ON "linkedinPublishingAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "linkedinConnection" ADD CONSTRAINT "linkedinConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinOAuthAttempt" ADD CONSTRAINT "linkedinOAuthAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPublishingAttempt" ADD CONSTRAINT "linkedinPublishingAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPublishingAttempt" ADD CONSTRAINT "linkedinPublishingAttempt_linkedinConnectionId_fkey" FOREIGN KEY ("linkedinConnectionId") REFERENCES "linkedinConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPublishingAttempt" ADD CONSTRAINT "linkedinPublishingAttempt_linkedinPublishingPlanId_fkey" FOREIGN KEY ("linkedinPublishingPlanId") REFERENCES "linkedinPublishingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPublishingAttempt" ADD CONSTRAINT "linkedinPublishingAttempt_linkedinPostId_fkey" FOREIGN KEY ("linkedinPostId") REFERENCES "linkedinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedinPublishingAttempt" ADD CONSTRAINT "linkedinPublishingAttempt_linkedinPostRevisionId_fkey" FOREIGN KEY ("linkedinPostRevisionId") REFERENCES "linkedinPostRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
