-- Migration: Create progress_events table for idempotent client progress submissions
-- Adds a lightweight events table to deduplicate client-submitted progress events

CREATE TABLE IF NOT EXISTS progress_events (
  id text PRIMARY KEY,
  user_id text,
  course_id text,
  lesson_id text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Optional index for querying by user/course/lesson
CREATE INDEX IF NOT EXISTS idx_progress_events_user_course ON progress_events (user_id, course_id);
