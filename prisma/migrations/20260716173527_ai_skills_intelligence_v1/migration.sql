-- CreateTable
CREATE TABLE "skillsInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeAnalysisId" TEXT,
    "jobCount" INTEGER NOT NULL DEFAULT 0,
    "analysisSource" TEXT NOT NULL DEFAULT 'rule_based',
    "aiModel" TEXT,
    "skillCoverageScore" INTEGER NOT NULL DEFAULT 0,
    "prioritySkills" JSONB NOT NULL DEFAULT '[]',
    "learningRoadmap" JSONB NOT NULL DEFAULT '[]',
    "projectIdeas" JSONB NOT NULL DEFAULT '[]',
    "resumeSkillAdvice" JSONB NOT NULL DEFAULT '[]',
    "marketSignals" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skillsInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skillsInsight_userId_idx" ON "skillsInsight"("userId");

-- CreateIndex
CREATE INDEX "skillsInsight_createdAt_idx" ON "skillsInsight"("createdAt");

-- AddForeignKey
ALTER TABLE "skillsInsight" ADD CONSTRAINT "skillsInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
