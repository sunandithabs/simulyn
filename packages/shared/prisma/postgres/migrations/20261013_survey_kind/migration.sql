-- Separate the quick-survey score from the SUS score: they were sharing one column.
ALTER TABLE "SurveyResponse" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'SUS';
ALTER TABLE "SurveyResponse" ADD COLUMN "quickScore" DOUBLE PRECISION;
ALTER TABLE "SurveyResponse" ALTER COLUMN "susScore" DROP NOT NULL;
UPDATE "SurveyResponse"
SET "kind" = 'QUICK', "quickScore" = "susScore", "susScore" = NULL
WHERE jsonb_array_length("susAnswers"::jsonb) = 3;
