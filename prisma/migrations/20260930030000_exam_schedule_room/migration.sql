-- Exam schedule room
-- NON-DESTRUCTIVE: adds one nullable column. No data is dropped or altered.
-- Admit cards previously invented room numbers (101/102/103 cycling); they now
-- show the real room when set, and hide the room line when it isn't.

ALTER TABLE "ExamSchedule" ADD COLUMN IF NOT EXISTS "room" TEXT;
