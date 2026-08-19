-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExamAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "questionOrder" TEXT NOT NULL,
    "integrityScore" INTEGER NOT NULL DEFAULT 100,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "terminated" BOOLEAN NOT NULL DEFAULT false,
    "terminatedAt" DATETIME,
    "terminatedReason" TEXT,
    "terminatedBy" TEXT,
    "violationBaseline" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExamAttempt" ("autoSubmitted", "examId", "flagged", "id", "integrityScore", "questionOrder", "startedAt", "submittedAt", "totalScore", "userId") SELECT "autoSubmitted", "examId", "flagged", "id", "integrityScore", "questionOrder", "startedAt", "submittedAt", "totalScore", "userId" FROM "ExamAttempt";
DROP TABLE "ExamAttempt";
ALTER TABLE "new_ExamAttempt" RENAME TO "ExamAttempt";
CREATE INDEX "ExamAttempt_examId_idx" ON "ExamAttempt"("examId");
CREATE INDEX "ExamAttempt_userId_idx" ON "ExamAttempt"("userId");
CREATE UNIQUE INDEX "ExamAttempt_examId_userId_key" ON "ExamAttempt"("examId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
