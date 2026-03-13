-- Ensure assignment contract fields have consistent defaults and presence
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.assignments
      ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
      ALTER COLUMN metadata SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.assignments
      ALTER COLUMN status SET DEFAULT 'assigned';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'active'
  ) THEN
    ALTER TABLE public.assignments
      ALTER COLUMN active SET DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'progress'
  ) THEN
    ALTER TABLE public.assignments
      ALTER COLUMN progress SET DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.assignments
      ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.assignments
      ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

ALTER TABLE IF EXISTS public.assignments
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by text;

COMMENT ON COLUMN public.assignments.metadata IS
  'Structured course assignment metadata (surface, mode, analytics context).';
