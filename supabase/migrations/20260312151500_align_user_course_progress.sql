-- Align user_course_progress with the current LMS contract.
-- Converts legacy text/json columns to uuid/numeric and backfills missing columns.

DO $$
DECLARE
  progress_column_exists boolean;
BEGIN
  SELECT COUNT(*) > 0
    INTO progress_column_exists
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_course_progress'
    AND column_name = 'progress';

  IF NOT progress_column_exists THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_course_progress'
        AND column_name = 'percent'
    ) THEN
      EXECUTE 'ALTER TABLE public.user_course_progress RENAME COLUMN percent TO progress';
    ELSE
      EXECUTE 'ALTER TABLE public.user_course_progress ADD COLUMN progress numeric NOT NULL DEFAULT 0';
    END IF;
  END IF;
END $$;

DO $$
DECLARE col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_course_progress'
    AND column_name = 'progress';

  IF col_type IS NOT NULL AND col_type <> 'numeric' THEN
    EXECUTE $sql$
      ALTER TABLE public.user_course_progress
      ALTER COLUMN progress TYPE numeric
      USING (
        CASE
          WHEN jsonb_typeof(progress) = 'number' THEN (progress::text)::numeric
          WHEN jsonb_typeof(progress) = 'object' AND progress ? 'percent'
            THEN NULLIF(progress->>'percent', '')::numeric
          WHEN progress::text ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN progress::text::numeric
          ELSE 0
        END
      ),
      ALTER COLUMN progress SET DEFAULT 0
    $sql$;
  END IF;
END $$;

DO $$
DECLARE col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_course_progress'
    AND column_name = 'id';

  IF col_type = 'text' THEN
    EXECUTE 'ALTER TABLE public.user_course_progress ALTER COLUMN id TYPE uuid USING id::uuid';
  END IF;

  EXECUTE 'ALTER TABLE public.user_course_progress ALTER COLUMN id SET DEFAULT gen_random_uuid()';
END $$;

DO $$
DECLARE col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_course_progress'
    AND column_name = 'course_id';

  IF col_type = 'text' THEN
    EXECUTE 'ALTER TABLE public.user_course_progress ALTER COLUMN course_id TYPE uuid USING course_id::uuid';
  END IF;
END $$;

DO $$
DECLARE col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_course_progress'
    AND column_name = 'user_id';

  IF col_type = 'text' THEN
    EXECUTE 'ALTER TABLE public.user_course_progress ALTER COLUMN user_id TYPE uuid USING user_id::uuid';
  END IF;
END $$;

ALTER TABLE public.user_course_progress
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS time_spent_s integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.user_course_progress
  ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());

-- Ensure indexes exist after type changes.
CREATE UNIQUE INDEX IF NOT EXISTS user_course_progress_unique ON public.user_course_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS user_course_progress_course_idx ON public.user_course_progress(course_id);
