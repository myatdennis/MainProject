BEGIN;

-- Ensure deterministic uniqueness contract for startup guard and progress upserts.
-- Keep the newest row per (user_id, course_id), remove older duplicates.
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, course_id
      ORDER BY
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.user_course_progress
), duplicates AS (
  SELECT ctid
  FROM ranked
  WHERE rn > 1
)
DELETE FROM public.user_course_progress p
USING duplicates d
WHERE p.ctid = d.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS user_course_progress_unique
  ON public.user_course_progress (user_id, course_id);

COMMIT;
