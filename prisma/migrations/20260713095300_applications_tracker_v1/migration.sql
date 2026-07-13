-- AlterTable
ALTER TABLE "jobPosting" ADD COLUMN     "applicationNotes" TEXT,
ADD COLUMN     "applicationStatus" TEXT NOT NULL DEFAULT 'saved',
ADD COLUMN     "appliedAt" TIMESTAMP(3);
