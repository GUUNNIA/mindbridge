-- CreateEnum
CREATE TYPE "ClinicalNoteStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "counselorId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessmentText" TEXT,
    "plan" TEXT,
    "summaryForEmployee" TEXT,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ClinicalNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "encKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNote_sessionId_key" ON "ClinicalNote"("sessionId");

-- CreateIndex
CREATE INDEX "ClinicalNote_counselorId_createdAt_idx" ON "ClinicalNote"("counselorId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalNote_employeeId_createdAt_idx" ON "ClinicalNote"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalNote_status_createdAt_idx" ON "ClinicalNote"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_counselorId_fkey" FOREIGN KEY ("counselorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
