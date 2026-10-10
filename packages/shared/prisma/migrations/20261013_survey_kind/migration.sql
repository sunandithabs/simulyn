-- Separate the quick-survey score from the SUS score: they were sharing one column.
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SurveyResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "susAnswers" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SUS',
    "susScore" REAL,
    "quickScore" REAL,
    "freeText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SurveyResponse" ("id", "userId", "susAnswers", "kind", "susScore", "quickScore", "freeText", "createdAt")
SELECT "id", "userId", "susAnswers",
  CASE WHEN json_array_length("susAnswers") = 3 THEN 'QUICK' ELSE 'SUS' END,
  CASE WHEN json_array_length("susAnswers") = 3 THEN NULL ELSE "susScore" END,
  CASE WHEN json_array_length("susAnswers") = 3 THEN "susScore" ELSE NULL END,
  "freeText", "createdAt"
FROM "SurveyResponse";
DROP TABLE "SurveyResponse";
ALTER TABLE "new_SurveyResponse" RENAME TO "SurveyResponse";
CREATE UNIQUE INDEX "SurveyResponse_userId_key" ON "SurveyResponse"("userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
