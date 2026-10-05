-- AlterTable
-- ExamAttempt.flagged has been in the schema since the proctoring work but was
-- never added by a Postgres migration, so every query that selects an attempt
-- (the exam list, starting an exam) failed with "column does not exist".
-- IF NOT EXISTS makes this safe on databases that were created with `db push`
-- and already have the column.
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "flagged" BOOLEAN NOT NULL DEFAULT false;
