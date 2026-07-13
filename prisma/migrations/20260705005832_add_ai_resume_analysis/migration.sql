-- AlterTable
ALTER TABLE "resumeAnalysis" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiWarnings" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "analysisSource" TEXT NOT NULL DEFAULT 'rule_based',
ADD COLUMN     "atsRecommendations" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "profileSummary" TEXT,
ADD COLUMN     "strengths" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "weaknesses" JSONB NOT NULL DEFAULT '[]';
