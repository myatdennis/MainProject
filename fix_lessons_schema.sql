-- Fix lessons table schema to match the application expectations
-- Add missing columns and rename existing ones

-- Add description column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.lessons ADD COLUMN description text;
  END IF;
END$$;

-- Add completion_rule_json if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'completion_rule_json'
  ) THEN
    ALTER TABLE public.lessons ADD COLUMN completion_rule_json jsonb;
  END IF;
END$$;

-- Rename content to content_json if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'content'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'content_json'
  ) THEN
    ALTER TABLE public.lessons RENAME COLUMN content TO content_json;
  END IF;
END$$;

-- Add content_json if it doesn't exist at all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'content_json'
  ) THEN
    ALTER TABLE public.lessons ADD COLUMN content_json jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- Add duration_s as integer if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'duration_s'
  ) THEN
    -- If duration (text) exists, try to convert and migrate
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'duration'
    ) THEN
      -- Add new column
      ALTER TABLE public.lessons ADD COLUMN duration_s integer;
      -- Try to convert text duration to integer (this may need manual intervention for existing data)
      UPDATE public.lessons SET duration_s = NULLIF(duration, '')::integer WHERE duration IS NOT NULL AND duration ~ '^\d+$';
    ELSE
      ALTER TABLE public.lessons ADD COLUMN duration_s integer;
    END IF;
  END IF;
END$$;

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Verify the updated schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'lessons'
ORDER BY ordinal_position;
