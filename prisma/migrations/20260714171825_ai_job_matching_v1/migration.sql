-- AlterTable
ALTER TABLE "jobAnalysis" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiWarnings" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "analysisSource" TEXT NOT NULL DEFAULT 'rule_based',
ADD COLUMN     "applicationStrategy" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "fitSummary" TEXT,
ADD COLUMN     "resumeTailoringTips" JSONB NOT NULL DEFAULT '[]';
