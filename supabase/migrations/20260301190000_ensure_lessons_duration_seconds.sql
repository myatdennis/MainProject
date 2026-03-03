-- Ensure lessons.duration_s exists for autosave/publish payloads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lessons'
      AND column_name = 'duration_s'
  ) THEN
    ALTER TABLE public.lessons
      ADD COLUMN duration_s integer;
  END IF;
END $$;

-- Backfill duration_s from legacy duration text when possible
DO $$
DECLARE
  duration_column_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lessons'
      AND column_name = 'duration'
  ) INTO duration_column_exists;

  IF duration_column_exists THEN
    UPDATE public.lessons
    SET duration_s = COALESCE(
      duration_s,
      NULLIF(regexp_replace(duration, '[^0-9]', '', 'g'), '')::int * 60
    )
    WHERE duration_s IS NULL
      AND duration IS NOT NULL
      AND duration ~ '[0-9]';
  END IF;
END $$;

COMMENT ON COLUMN public.lessons.duration_s IS 'Duration in seconds; derived from autosave payloads and legacy duration field.';
