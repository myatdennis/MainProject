-- Migration: add analytics tables and aggregate views/functions
-- Date: 2025-11-08
-- Dependencies: assumes `public.courses(id)` and `public.lessons(id)` exist (TEXT primary keys from 20250919231840_wild_cliff.sql).
-- This migration augments existing progress tables and can be re-run safely.

-- 1) analytics tables
CREATE TABLE IF NOT EXISTS public.user_course_progress (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_course_progress
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS progress numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_course_progress_course_id ON public.user_course_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_course_progress_user_id ON public.user_course_progress(user_id);

CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  lesson_id text NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_lesson_progress
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS course_id text,
  ADD COLUMN IF NOT EXISTS progress numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_lesson_progress_course_fk'
      AND table_schema = 'public'
      AND table_name = 'user_lesson_progress'
  ) THEN
    ALTER TABLE public.user_lesson_progress
      ADD CONSTRAINT user_lesson_progress_course_fk FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson_id ON public.user_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_course_id ON public.user_lesson_progress(course_id);

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  org_id uuid,
  course_id text REFERENCES public.courses(id) ON DELETE CASCADE,
  question_id text,
  response_text text,
  rating integer, -- optional numeric rating 1-5
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_course_id ON public.survey_responses(course_id);

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending/submitted/graded
  grade numeric(5,2),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments(course_id);

-- 2) aggregate views
-- Course-level completion rate view
CREATE OR REPLACE VIEW public.view_course_completion_rate AS
SELECT
  course_id,
  COUNT(*) FILTER (WHERE TRUE) AS total_users,
  COUNT(*) FILTER (WHERE completed) AS completed_count,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE completed) / NULLIF(COUNT(*),0),2)
  END AS completion_percent,
  MAX(updated_at) AS last_updated
FROM public.user_course_progress
GROUP BY course_id;

-- Course-level avg progress
CREATE OR REPLACE VIEW public.view_course_avg_progress AS
SELECT
  course_id,
  ROUND(AVG(progress)::numeric,2) AS avg_progress,
  MAX(updated_at) AS last_updated
FROM public.user_course_progress
GROUP BY course_id;

-- Lesson-level dropoff: percent of users who started course but did not complete lesson
CREATE OR REPLACE VIEW public.view_lesson_dropoff AS
SELECT
  course_id,
  lesson_id,
  COUNT(*) AS started_count,
  COUNT(*) FILTER (WHERE completed) AS completed_count,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND(100.0 * (1 - (COUNT(*) FILTER (WHERE completed) / NULLIF(COUNT(*),0)))::numeric,2)
  END AS dropoff_percent
FROM public.user_lesson_progress
GROUP BY course_id, lesson_id;

-- Engagement score (simple heuristic): combination of avg progress and activity volume
CREATE OR REPLACE FUNCTION public.fn_course_engagement_score(course_identifier text)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT
    ROUND(
      (COALESCE(cp.avg_progress,0) * 0.6) +
      (LEAST(COALESCE(activity.activity_count,0) / 10.0, 40) * 0.4),
      2
    ) AS score
  FROM (
    SELECT avg_progress FROM public.view_course_avg_progress WHERE course_id = course_identifier
  ) cp
  CROSS JOIN (
    SELECT COUNT(*)::numeric AS activity_count FROM (
      SELECT id FROM public.user_course_progress WHERE course_id = course_identifier
      UNION ALL
      SELECT id FROM public.user_lesson_progress WHERE course_id = course_identifier
      UNION ALL
      SELECT id FROM public.survey_responses WHERE course_id = course_identifier
    ) t
  ) activity;
$$;

-- 3) helper view for admin overview
CREATE OR REPLACE VIEW public.view_admin_overview AS
SELECT
  (SELECT COUNT(DISTINCT user_id) FROM public.user_course_progress) AS total_active_learners,
  (SELECT COUNT(DISTINCT org_id) FROM public.user_course_progress WHERE org_id IS NOT NULL) AS total_orgs,
  (SELECT COUNT(DISTINCT course_id) FROM public.user_course_progress) AS total_courses,
  (SELECT ROUND(AVG(avg_progress)::numeric,2) FROM public.view_course_avg_progress) AS platform_avg_progress,
  (SELECT ROUND(AVG(completion_percent)::numeric,2) FROM public.view_course_completion_rate) AS platform_avg_completion
;

-- Grant select permissions to anon/admin roles as appropriate in Supabase projects
-- (Do not grant broadly in production; configure RLS and policies to scope by org/user.)
