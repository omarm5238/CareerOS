-- AlterTable
ALTER TABLE "applicationPackage" ADD COLUMN     "coverLetterRevisionId" TEXT;

-- AddForeignKey
ALTER TABLE "applicationPackage" ADD CONSTRAINT "applicationPackage_coverLetterRevisionId_fkey" FOREIGN KEY ("coverLetterRevisionId") REFERENCES "communicationDraftRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
