-- AlterTable
ALTER TABLE "application" ADD COLUMN "submittedPackageId" TEXT,
ADD COLUMN "submittedExecutionAttemptId" TEXT;

-- AlterTable
ALTER TABLE "applicationPackage" ADD COLUMN "opportunityAnalysisSnapshotId" TEXT,
ADD COLUMN "sourceResumeRevisionId" TEXT,
ADD COLUMN "sourceResumeContentHash" TEXT,
ADD COLUMN "resumeAnalysisId" TEXT,
ADD COLUMN "packageHash" TEXT,
ADD COLUMN "packageJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "lockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "applicationSubmissionAttempt" ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "submitBoundaryCrossedAt" TIMESTAMP(3),
ADD COLUMN "destinationUrl" TEXT,
ADD COLUMN "confirmationType" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "application_submittedPackageId_key" ON "application"("submittedPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "application_submittedExecutionAttemptId_key" ON "application"("submittedExecutionAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "applicationSubmissionAttempt_idempotencyKey_key" ON "applicationSubmissionAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "applicationPackage_userId_createdAt_idx" ON "applicationPackage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "applicationPackage_opportunityAnalysisSnapshotId_idx" ON "applicationPackage"("opportunityAnalysisSnapshotId");

-- CreateIndex
CREATE INDEX "applicationPackage_sourceResumeRevisionId_idx" ON "applicationPackage"("sourceResumeRevisionId");

-- CreateIndex
CREATE INDEX "applicationPackage_resumeAnalysisId_idx" ON "applicationPackage"("resumeAnalysisId");

-- CreateIndex
CREATE INDEX "applicationPackage_resumeVersionRevisionId_idx" ON "applicationPackage"("resumeVersionRevisionId");

-- CreateIndex
CREATE INDEX "applicationPackage_packageHash_idx" ON "applicationPackage"("packageHash");

-- One active submit authority per package. Confirmed, failed, and uncertain attempts stay historical.
CREATE UNIQUE INDEX "applicationSubmissionAttempt_one_active_package"
ON "applicationSubmissionAttempt" ("applicationPackageId")
WHERE "status" IN ('APPROVAL_GRANTED', 'SUBMITTING', 'VERIFYING');

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_submittedPackageId_fkey" FOREIGN KEY ("submittedPackageId") REFERENCES "applicationPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_submittedExecutionAttemptId_fkey" FOREIGN KEY ("submittedExecutionAttemptId") REFERENCES "applicationSubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_opportunityAnalysisSnapshotId_fkey" FOREIGN KEY ("opportunityAnalysisSnapshotId") REFERENCES "opportunityAnalysisSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_sourceResumeRevisionId_fkey" FOREIGN KEY ("sourceResumeRevisionId") REFERENCES "resumeSourceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_resumeAnalysisId_fkey" FOREIGN KEY ("resumeAnalysisId") REFERENCES "resumeAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
