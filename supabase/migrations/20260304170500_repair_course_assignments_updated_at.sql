-- Ensure course_assignments updated_at exists and stays current without relying on assigned_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'course_assignments'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.course_assignments
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'course_assignments'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.course_assignments
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

ALTER TABLE public.course_assignments
  ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());

UPDATE public.course_assignments
SET updated_at = COALESCE(updated_at, created_at, timezone('utc'::text, now()))
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_course_assignments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_at IS NULL THEN
    NEW.created_at := timezone('utc'::text, now());
  END IF;
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS course_assignments_set_updated_at ON public.course_assignments;

CREATE TRIGGER course_assignments_set_updated_at
BEFORE UPDATE ON public.course_assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_course_assignments_updated_at();
