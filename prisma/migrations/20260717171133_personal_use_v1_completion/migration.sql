-- CreateTable
CREATE TABLE "careerBrief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisSource" TEXT NOT NULL DEFAULT 'rule_based',
    "aiModel" TEXT,
    "healthScore" INTEGER NOT NULL DEFAULT 0,
    "headline" TEXT,
    "summary" TEXT,
    "topRisks" JSONB NOT NULL DEFAULT '[]',
    "topOpportunities" JSONB NOT NULL DEFAULT '[]',
    "nextActions" JSONB NOT NULL DEFAULT '[]',
    "thirtyDayPlan" JSONB NOT NULL DEFAULT '[]',
    "actionCenter" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "careerBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "careerBrief_userId_idx" ON "careerBrief"("userId");

-- CreateIndex
CREATE INDEX "careerBrief_createdAt_idx" ON "careerBrief"("createdAt");

-- AddForeignKey
ALTER TABLE "careerBrief" ADD CONSTRAINT "careerBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
