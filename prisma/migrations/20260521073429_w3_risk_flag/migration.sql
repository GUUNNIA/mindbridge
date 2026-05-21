-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('L1_NOTICE', 'L2_ALERT', 'L3_ESCALATION', 'L4_EMERGENCY');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RiskSourceType" AS ENUM ('ASSESSMENT_RESPONSE', 'SESSION_MESSAGE', 'CLINICAL_NOTE');

-- CreateTable
CREATE TABLE "RiskFlag" (
    "id" TEXT NOT NULL,
    "sourceType" "RiskSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "companyId" TEXT,
    "level" "RiskLevel" NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'PENDING',
    "signals" JSONB NOT NULL,
    "summary" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "dismissReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskFlag_level_status_idx" ON "RiskFlag"("level", "status");

-- CreateIndex
CREATE INDEX "RiskFlag_subjectUserId_createdAt_idx" ON "RiskFlag"("subjectUserId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskFlag_companyId_createdAt_idx" ON "RiskFlag"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskFlag_sourceType_sourceId_idx" ON "RiskFlag"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "RiskFlag" ADD CONSTRAINT "RiskFlag_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFlag" ADD CONSTRAINT "RiskFlag_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
