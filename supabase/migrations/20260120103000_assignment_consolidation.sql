-- Migration: Consolidate course assignments into public.assignments
-- Date: 2026-01-20

-- 1) Ensure new columns exist on public.assignments so it can store learner metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'note'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN note text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'assigned_by'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN assigned_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.assignments
      ADD COLUMN status text NOT NULL DEFAULT 'assigned'
      CHECK (status IN ('assigned', 'in-progress', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'progress'
  ) THEN
    ALTER TABLE public.assignments
      ADD COLUMN progress integer NOT NULL DEFAULT 0
      CHECK (progress >= 0 AND progress <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN idempotency_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'client_request_id'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN client_request_id text;
  END IF;
END$$;

-- 2) Normalize defaults/check constraints in case columns already existed without them
ALTER TABLE public.assignments
  ALTER COLUMN status SET DEFAULT 'assigned';
ALTER TABLE public.assignments
  ALTER COLUMN progress SET DEFAULT 0;

-- 3) Backfill organization_id from courses when missing so migrated rows remain scoped
UPDATE public.assignments a
SET organization_id = c.organization_id
FROM public.courses c
WHERE a.course_id = c.id
  AND a.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- 4) Copy data from legacy course_assignments if the table is still present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'course_assignments'
  ) THEN
    INSERT INTO public.assignments (
      id,
      course_id,
      user_id,
      organization_id,
      due_at,
      note,
      assigned_by,
      status,
      progress,
      created_at,
      updated_at,
      active
    )
    SELECT
      ca.id,
      ca.course_id,
      ca.user_id,
      COALESCE(c.organization_id, a.organization_id),
      ca.due_date,
      ca.note,
      ca.assigned_by,
      ca.status,
      ca.progress,
      ca.created_at,
      ca.updated_at,
      TRUE
    FROM public.course_assignments ca
    LEFT JOIN public.courses c ON c.id = ca.course_id
    LEFT JOIN public.assignments a ON a.id = ca.id
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      organization_id = COALESCE(EXCLUDED.organization_id, public.assignments.organization_id),
      due_at = EXCLUDED.due_at,
      note = EXCLUDED.note,
      assigned_by = EXCLUDED.assigned_by,
      status = EXCLUDED.status,
      progress = EXCLUDED.progress,
      created_at = LEAST(public.assignments.created_at, EXCLUDED.created_at),
      updated_at = GREATEST(public.assignments.updated_at, EXCLUDED.updated_at),
      active = TRUE;

    DROP TABLE public.course_assignments;
  END IF;
END$$;

-- 5) Create new indexes/constraints to enforce uniqueness and support idempotency lookups
CREATE UNIQUE INDEX IF NOT EXISTS assignments_unique_user_per_course
  ON public.assignments(course_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_unique_org_per_course
  ON public.assignments(course_id, organization_id)
  WHERE user_id IS NULL AND organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_idempotency_key_idx
  ON public.assignments (
    idempotency_key,
    coalesce(user_id, 'user:null'),
    coalesce(organization_id, 'org:null')
  )
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_client_request_id_idx
  ON public.assignments (
    client_request_id,
    coalesce(user_id, 'user:null'),
    coalesce(organization_id, 'org:null')
  )
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS assignments_status_idx ON public.assignments(status);
CREATE INDEX IF NOT EXISTS assignments_progress_idx ON public.assignments(progress);
CREATE INDEX IF NOT EXISTS assignments_org_idx ON public.assignments(organization_id);

-- 6) Ensure updated_at stays current after the new columns/updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'assignments_set_updated_at'
  ) THEN
    CREATE TRIGGER assignments_set_updated_at
    BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;
