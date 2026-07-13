-- CreateTable
CREATE TABLE "jobPosting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "jobUrl" TEXT,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobAnalysis" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "roleAlignment" TEXT NOT NULL,
    "matchedSkills" JSONB NOT NULL,
    "missingSkills" JSONB NOT NULL,
    "resumeSignals" JSONB NOT NULL,
    "jobSignals" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobPosting_userId_idx" ON "jobPosting"("userId");

-- CreateIndex
CREATE INDEX "jobPosting_createdAt_idx" ON "jobPosting"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobAnalysis_jobPostingId_key" ON "jobAnalysis"("jobPostingId");

-- AddForeignKey
ALTER TABLE "jobPosting" ADD CONSTRAINT "jobPosting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobAnalysis" ADD CONSTRAINT "jobAnalysis_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "jobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
