-- CreateEnum
CREATE TYPE "CareerMemoryType" AS ENUM ('FACT', 'PREFERENCE', 'GOAL', 'SKILL_SIGNAL', 'EVIDENCE_SIGNAL', 'BEHAVIOR_PATTERN', 'CAREER_PATTERN', 'CONSTRAINT', 'MILESTONE', 'FOCUS');

-- CreateEnum
CREATE TYPE "CareerMemoryCategory" AS ENUM ('CAREER_TARGET', 'ROLE', 'SKILL', 'EVIDENCE', 'APPLICATION', 'JOB_SEARCH', 'LINKEDIN', 'EXECUTION', 'COMMUNICATION', 'PREFERENCE', 'GOAL', 'CONSTRAINT', 'PROJECT', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "CareerMemoryStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'CONTRADICTED', 'EXPIRED', 'SUPPRESSED', 'DELETED');

-- CreateEnum
CREATE TYPE "CareerMemoryConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CareerMemoryImportance" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CareerMemorySourceType" AS ENUM ('USER_DECLARED', 'M21_RESUME', 'M22_APPLICATION', 'M23_JOBS', 'M24_COMMUNICATION', 'M25_LINKEDIN', 'M26_DAILY', 'M27_WEEKLY', 'SYSTEM_DERIVED', 'USER_CORRECTED');

-- CreateEnum
CREATE TYPE "CareerMemoryEvidenceType" AS ENUM ('USER_STATEMENT', 'DOMAIN_EVENT', 'WEEKLY_PATTERN', 'DAILY_PATTERN', 'SYSTEM_DERIVATION', 'USER_CORRECTION', 'USER_CONFIRMATION');

-- CreateEnum
CREATE TYPE "CareerGraphEntityType" AS ENUM ('USER', 'ROLE', 'SKILL', 'COMPANY', 'JOB', 'APPLICATION', 'RESUME', 'PROJECT', 'LINKEDIN_POST', 'CAREER_GOAL', 'EVIDENCE_AREA', 'LOCATION', 'WORK_STYLE');

-- CreateEnum
CREATE TYPE "CareerGraphRelationType" AS ENUM ('TARGETS_ROLE', 'HAS_SKILL', 'NEEDS_SKILL', 'HAS_EVIDENCE_FOR', 'LACKS_EVIDENCE_FOR', 'APPLIED_TO', 'INTERVIEWED_WITH', 'USED_RESUME_FOR', 'PUBLISHED_ABOUT', 'WORKED_ON_PROJECT', 'PREFERS_LOCATION', 'PREFERS_WORK_STYLE', 'FOCUSES_ON', 'RELATED_TO');

-- CreateEnum
CREATE TYPE "CareerGraphStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'EXPIRED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "CareerMemoryEventType" AS ENUM ('CREATED', 'CONFIRMED', 'UPDATED', 'CONFIDENCE_CHANGED', 'CONTRADICTED', 'SUPERSEDED', 'EXPIRED', 'SUPPRESSED', 'RESTORED', 'USER_CORRECTED', 'DELETED', 'RESET', 'REBUILT');

-- CreateEnum
CREATE TYPE "CareerMemoryContradictionClass" AS ENUM ('HARD_CONTRADICTION', 'SOFT_CONFLICT', 'TEMPORAL_CHANGE');

-- CreateTable
CREATE TABLE "careerMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CareerMemoryType" NOT NULL,
    "category" "CareerMemoryCategory" NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "normalizedValueKey" TEXT,
    "valueJson" JSONB NOT NULL DEFAULT '{}',
    "normalizedText" TEXT NOT NULL,
    "semanticKey" TEXT NOT NULL,
    "status" "CareerMemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "confidence" "CareerMemoryConfidence" NOT NULL,
    "confidenceScore" INTEGER,
    "importance" "CareerMemoryImportance" NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "firstObservedAt" TIMESTAMP(3) NOT NULL,
    "lastObservedAt" TIMESTAMP(3) NOT NULL,
    "lastConfirmedAt" TIMESTAMP(3),
    "sourceType" "CareerMemorySourceType" NOT NULL,
    "isUserDeclared" BOOLEAN NOT NULL DEFAULT false,
    "isUserCorrected" BOOLEAN NOT NULL DEFAULT false,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "supersedesMemoryId" TEXT,
    "contradictedByMemoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "careerMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careerMemoryEvidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "careerMemoryId" TEXT NOT NULL,
    "sourceSubsystem" "CareerMemorySourceType" NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "sourceEventId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "evidenceType" "CareerMemoryEvidenceType" NOT NULL,
    "evidenceJson" JSONB NOT NULL DEFAULT '{}',
    "weight" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "careerMemoryEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careerGraphEntity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "CareerGraphEntityType" NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "status" "CareerGraphStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "careerGraphEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careerGraphRelation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "relationType" "CareerGraphRelationType" NOT NULL,
    "confidence" "CareerMemoryConfidence" NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "evidenceJson" JSONB NOT NULL DEFAULT '{}',
    "status" "CareerGraphStatus" NOT NULL DEFAULT 'ACTIVE',
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "careerGraphRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careerMemoryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "careerMemoryId" TEXT,
    "eventType" "CareerMemoryEventType" NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "careerMemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careerMemoryPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowBehavioralMemory" BOOLEAN NOT NULL DEFAULT true,
    "allowDerivedPatterns" BOOLEAN NOT NULL DEFAULT true,
    "allowLongTermPreferences" BOOLEAN NOT NULL DEFAULT true,
    "retentionMode" TEXT,
    "memoryResetAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "careerMemoryPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "careerMemory_userId_idx" ON "careerMemory"("userId");

-- CreateIndex
CREATE INDEX "careerMemory_status_idx" ON "careerMemory"("status");

-- CreateIndex
CREATE INDEX "careerMemory_category_idx" ON "careerMemory"("category");

-- CreateIndex
CREATE INDEX "careerMemory_subjectKey_idx" ON "careerMemory"("subjectKey");

-- CreateIndex
CREATE INDEX "careerMemory_semanticKey_idx" ON "careerMemory"("semanticKey");

-- CreateIndex
CREATE INDEX "careerMemory_confidence_idx" ON "careerMemory"("confidence");

-- CreateIndex
CREATE INDEX "careerMemory_lastObservedAt_idx" ON "careerMemory"("lastObservedAt");

-- CreateIndex
CREATE INDEX "careerMemory_userId_semanticKey_status_idx" ON "careerMemory"("userId", "semanticKey", "status");

-- CreateIndex
CREATE INDEX "careerMemoryEvidence_userId_idx" ON "careerMemoryEvidence"("userId");

-- CreateIndex
CREATE INDEX "careerMemoryEvidence_careerMemoryId_idx" ON "careerMemoryEvidence"("careerMemoryId");

-- CreateIndex
CREATE INDEX "careerMemoryEvidence_sourceSubsystem_idx" ON "careerMemoryEvidence"("sourceSubsystem");

-- CreateIndex
CREATE INDEX "careerMemoryEvidence_observedAt_idx" ON "careerMemoryEvidence"("observedAt");

-- CreateIndex
CREATE INDEX "careerMemoryEvidence_fingerprint_idx" ON "careerMemoryEvidence"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "careerMemoryEvidence_userId_fingerprint_key" ON "careerMemoryEvidence"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "careerGraphEntity_userId_idx" ON "careerGraphEntity"("userId");

-- CreateIndex
CREATE INDEX "careerGraphEntity_canonicalKey_idx" ON "careerGraphEntity"("canonicalKey");

-- CreateIndex
CREATE INDEX "careerGraphEntity_entityType_idx" ON "careerGraphEntity"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "careerGraphEntity_userId_canonicalKey_key" ON "careerGraphEntity"("userId", "canonicalKey");

-- CreateIndex
CREATE INDEX "careerGraphRelation_userId_idx" ON "careerGraphRelation"("userId");

-- CreateIndex
CREATE INDEX "careerGraphRelation_relationType_idx" ON "careerGraphRelation"("relationType");

-- CreateIndex
CREATE INDEX "careerGraphRelation_fromEntityId_idx" ON "careerGraphRelation"("fromEntityId");

-- CreateIndex
CREATE INDEX "careerGraphRelation_toEntityId_idx" ON "careerGraphRelation"("toEntityId");

-- CreateIndex
CREATE INDEX "careerGraphRelation_status_idx" ON "careerGraphRelation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "careerGraphRelation_userId_fingerprint_key" ON "careerGraphRelation"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "careerMemoryEvent_userId_idx" ON "careerMemoryEvent"("userId");

-- CreateIndex
CREATE INDEX "careerMemoryEvent_careerMemoryId_idx" ON "careerMemoryEvent"("careerMemoryId");

-- CreateIndex
CREATE INDEX "careerMemoryEvent_createdAt_idx" ON "careerMemoryEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "careerMemoryPreference_userId_key" ON "careerMemoryPreference"("userId");

-- CreateIndex
CREATE INDEX "careerMemoryPreference_userId_idx" ON "careerMemoryPreference"("userId");

-- AddForeignKey
ALTER TABLE "careerMemory" ADD CONSTRAINT "careerMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerMemory" ADD CONSTRAINT "careerMemory_supersedesMemoryId_fkey" FOREIGN KEY ("supersedesMemoryId") REFERENCES "careerMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerMemory" ADD CONSTRAINT "careerMemory_contradictedByMemoryId_fkey" FOREIGN KEY ("contradictedByMemoryId") REFERENCES "careerMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerMemoryEvidence" ADD CONSTRAINT "careerMemoryEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerMemoryEvidence" ADD CONSTRAINT "careerMemoryEvidence_careerMemoryId_fkey" FOREIGN KEY ("careerMemoryId") REFERENCES "careerMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerGraphEntity" ADD CONSTRAINT "careerGraphEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerGraphRelation" ADD CONSTRAINT "careerGraphRelation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerGraphRelation" ADD CONSTRAINT "careerGraphRelation_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "careerGraphEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerGraphRelation" ADD CONSTRAINT "careerGraphRelation_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "careerGraphEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerMemoryEvent" ADD CONSTRAINT "careerMemoryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerMemoryEvent" ADD CONSTRAINT "careerMemoryEvent_careerMemoryId_fkey" FOREIGN KEY ("careerMemoryId") REFERENCES "careerMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careerMemoryPreference" ADD CONSTRAINT "careerMemoryPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
