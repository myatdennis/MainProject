DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'course_assignments'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.course_assignments
      ADD COLUMN created_at timestamptz DEFAULT timezone('utc', now());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'course_assignments'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.course_assignments
      ADD COLUMN updated_at timestamptz DEFAULT timezone('utc', now());
  END IF;
END $$;

UPDATE public.course_assignments
SET updated_at = COALESCE(updated_at, created_at, timezone('utc', now()))
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_course_assignments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS course_assignments_set_updated_at ON public.course_assignments;

CREATE TRIGGER course_assignments_set_updated_at
BEFORE UPDATE ON public.course_assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_course_assignments_updated_at();
