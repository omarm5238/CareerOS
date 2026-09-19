-- CreateEnum
CREATE TYPE "WeeklyCareerReviewStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "WeeklyCareerGenerationSource" AS ENUM ('DETERMINISTIC', 'AI_ASSISTED', 'FALLBACK');

-- CreateEnum
CREATE TYPE "WeeklyCareerMomentumBand" AS ENUM ('STRONG', 'STEADY', 'MIXED', 'LOW');

-- CreateEnum
CREATE TYPE "WeeklyCareerMetricCategory" AS ENUM ('EXECUTION', 'OPPORTUNITIES', 'APPLICATIONS', 'FOLLOW_UP', 'RESUME', 'COMMUNICATION', 'LINKEDIN', 'SKILLS_EVIDENCE');

-- CreateEnum
CREATE TYPE "WeeklyCareerMetricApplicability" AS ENUM ('DATA_AVAILABLE', 'NO_ACTIVITY', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "WeeklyCareerMetricSourceSubsystem" AS ENUM ('M21_RESUME', 'M22_APPLICATION', 'M23_JOBS', 'M24_COMMUNICATION', 'M25_LINKEDIN', 'M26_DAILY');

-- CreateEnum
CREATE TYPE "WeeklyCareerInsightType" AS ENUM ('PROGRESS_PATTERN', 'STALL_PATTERN', 'CONSISTENCY_PATTERN', 'OPPORTUNITY_GAP', 'FOLLOW_UP_GAP', 'EXECUTION_GAP', 'VISIBILITY_GAP', 'EVIDENCE_GAP', 'APPLICATION_FUNNEL_PATTERN', 'NEXT_WEEK_FOCUS');

-- CreateEnum
CREATE TYPE "WeeklyCareerInsightConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "WeeklyCareerInsightSeverity" AS ENUM ('INFO', 'ATTENTION');

-- CreateEnum
CREATE TYPE "WeeklyCareerRecommendationStatus" AS ENUM ('OPEN', 'ADOPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "WeeklyCareerRecommendationPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "weeklyCareerReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartLocalDate" TEXT NOT NULL,
    "weekEndLocalDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "WeeklyCareerReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "contextFingerprint" TEXT NOT NULL,
    "generationSource" "WeeklyCareerGenerationSource" NOT NULL DEFAULT 'DETERMINISTIC',
    "overallMomentumScore" INTEGER,
    "overallMomentumBand" "WeeklyCareerMomentumBand",
    "summary" TEXT,
    "winsSummary" TEXT,
    "frictionSummary" TEXT,
    "componentsJson" JSONB NOT NULL DEFAULT '{}',
    "comparisonJson" JSONB NOT NULL DEFAULT '{}',
    "winsJson" JSONB NOT NULL DEFAULT '[]',
    "frictionJson" JSONB NOT NULL DEFAULT '[]',
    "limitationsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weeklyCareerReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeklyCareerMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyCareerReviewId" TEXT NOT NULL,
    "category" "WeeklyCareerMetricCategory" NOT NULL,
    "metricKey" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "denominatorValue" DOUBLE PRECISION,
    "applicability" "WeeklyCareerMetricApplicability" NOT NULL,
    "sourceSubsystem" "WeeklyCareerMetricSourceSubsystem" NOT NULL,
    "evidenceJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weeklyCareerMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeklyCareerInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyCareerReviewId" TEXT NOT NULL,
    "type" "WeeklyCareerInsightType" NOT NULL,
    "category" "WeeklyCareerMetricCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL DEFAULT '{}',
    "confidence" "WeeklyCareerInsightConfidence" NOT NULL,
    "severity" "WeeklyCareerInsightSeverity" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weeklyCareerInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeklyCareerRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyCareerReviewId" TEXT NOT NULL,
    "category" "WeeklyCareerMetricCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" "WeeklyCareerRecommendationPriority" NOT NULL,
    "sourceEvidenceJson" JSONB NOT NULL DEFAULT '{}',
    "recommendedActionType" TEXT,
    "deepLink" TEXT,
    "status" "WeeklyCareerRecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "adoptedAt" TIMESTAMP(3),
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weeklyCareerRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weeklyCareerReview_userId_idx" ON "weeklyCareerReview"("userId");

-- CreateIndex
CREATE INDEX "weeklyCareerReview_weekStartLocalDate_idx" ON "weeklyCareerReview"("weekStartLocalDate");

-- CreateIndex
CREATE INDEX "weeklyCareerReview_status_idx" ON "weeklyCareerReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "weeklyCareerReview_userId_weekStartLocalDate_key" ON "weeklyCareerReview"("userId", "weekStartLocalDate");

-- CreateIndex
CREATE INDEX "weeklyCareerMetric_userId_idx" ON "weeklyCareerMetric"("userId");

-- CreateIndex
CREATE INDEX "weeklyCareerMetric_weeklyCareerReviewId_idx" ON "weeklyCareerMetric"("weeklyCareerReviewId");

-- CreateIndex
CREATE INDEX "weeklyCareerMetric_category_idx" ON "weeklyCareerMetric"("category");

-- CreateIndex
CREATE UNIQUE INDEX "weeklyCareerMetric_weeklyCareerReviewId_metricKey_key" ON "weeklyCareerMetric"("weeklyCareerReviewId", "metricKey");

-- CreateIndex
CREATE INDEX "weeklyCareerInsight_userId_idx" ON "weeklyCareerInsight"("userId");

-- CreateIndex
CREATE INDEX "weeklyCareerInsight_weeklyCareerReviewId_idx" ON "weeklyCareerInsight"("weeklyCareerReviewId");

-- CreateIndex
CREATE INDEX "weeklyCareerInsight_type_idx" ON "weeklyCareerInsight"("type");

-- CreateIndex
CREATE UNIQUE INDEX "weeklyCareerInsight_weeklyCareerReviewId_fingerprint_key" ON "weeklyCareerInsight"("weeklyCareerReviewId", "fingerprint");

-- CreateIndex
CREATE INDEX "weeklyCareerRecommendation_userId_idx" ON "weeklyCareerRecommendation"("userId");

-- CreateIndex
CREATE INDEX "weeklyCareerRecommendation_weeklyCareerReviewId_idx" ON "weeklyCareerRecommendation"("weeklyCareerReviewId");

-- CreateIndex
CREATE INDEX "weeklyCareerRecommendation_status_idx" ON "weeklyCareerRecommendation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "weeklyCareerRecommendation_weeklyCareerReviewId_fingerprint_key" ON "weeklyCareerRecommendation"("weeklyCareerReviewId", "fingerprint");

-- AddForeignKey
ALTER TABLE "weeklyCareerReview" ADD CONSTRAINT "weeklyCareerReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeklyCareerMetric" ADD CONSTRAINT "weeklyCareerMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeklyCareerMetric" ADD CONSTRAINT "weeklyCareerMetric_weeklyCareerReviewId_fkey" FOREIGN KEY ("weeklyCareerReviewId") REFERENCES "weeklyCareerReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeklyCareerInsight" ADD CONSTRAINT "weeklyCareerInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeklyCareerInsight" ADD CONSTRAINT "weeklyCareerInsight_weeklyCareerReviewId_fkey" FOREIGN KEY ("weeklyCareerReviewId") REFERENCES "weeklyCareerReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeklyCareerRecommendation" ADD CONSTRAINT "weeklyCareerRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeklyCareerRecommendation" ADD CONSTRAINT "weeklyCareerRecommendation_weeklyCareerReviewId_fkey" FOREIGN KEY ("weeklyCareerReviewId") REFERENCES "weeklyCareerReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
