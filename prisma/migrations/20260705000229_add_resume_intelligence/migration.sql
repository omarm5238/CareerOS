-- CreateTable
CREATE TABLE "resumeDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "textLength" INTEGER NOT NULL,
    "textPreview" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumeAnalysis" (
    "id" TEXT NOT NULL,
    "resumeDocumentId" TEXT NOT NULL,
    "detectedRole" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "completenessScore" INTEGER NOT NULL,
    "detectedSkills" JSONB NOT NULL,
    "suggestedFocus" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resumeDocument_userId_idx" ON "resumeDocument"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "resumeAnalysis_resumeDocumentId_key" ON "resumeAnalysis"("resumeDocumentId");

-- AddForeignKey
ALTER TABLE "resumeDocument" ADD CONSTRAINT "resumeDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumeAnalysis" ADD CONSTRAINT "resumeAnalysis_resumeDocumentId_fkey" FOREIGN KEY ("resumeDocumentId") REFERENCES "resumeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
