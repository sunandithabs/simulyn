-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "terminated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terminatedAt" TIMESTAMP(3),
ADD COLUMN     "terminatedBy" TEXT,
ADD COLUMN     "terminatedReason" TEXT,
ADD COLUMN     "violationBaseline" INTEGER NOT NULL DEFAULT 0;
