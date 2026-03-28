-- Ensure functions have immutable search_path as per security lint (0011_function_search_path_mutable).
-- This avoids dependency on role-specific search_path and improves RLS security posture.

BEGIN;

-- 1) sync_membership_org_columns
CREATE OR REPLACE FUNCTION public.sync_membership_org_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.org_id IS NOT NULL THEN
    BEGIN
      NEW.organization_id := NULLIF(NEW.org_id::text, '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NEW.org_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    NEW.org_id := NEW.organization_id::text;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) sync_org_invites_org_columns
CREATE OR REPLACE FUNCTION public.sync_org_invites_org_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.org_id IS NOT NULL THEN
    BEGIN
      NEW.organization_id := NULLIF(NEW.org_id::text, '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NEW.org_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    NEW.org_id := NEW.organization_id::text;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) sync_lesson_progress_status
CREATE OR REPLACE FUNCTION public.sync_lesson_progress_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.completed IS DISTINCT FROM OLD.completed OR
     NEW.progress IS DISTINCT FROM OLD.progress OR
     NEW.percent IS DISTINCT FROM OLD.percent THEN
    IF NEW.progress <> 0 AND NEW.percent = 0 THEN
      NEW.percent := NEW.progress;
    ELSIF NEW.percent <> 0 AND NEW.progress = 0 THEN
      NEW.progress := NEW.percent;
    END IF;

    IF NEW.completed = true OR GREATEST(NEW.progress, NEW.percent) >= 100 THEN
      NEW.status := 'completed';
      NEW.completed := true;
    ELSE
      NEW.status := COALESCE(NULLIF(NEW.status, ''), 'in_progress');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) sync_course_progress_percent
CREATE OR REPLACE FUNCTION public.sync_course_progress_percent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.progress IS NOT NULL AND (NEW.percent IS NULL OR NEW.percent = 0) THEN
    NEW.percent := NEW.progress;
  ELSIF NEW.percent IS NOT NULL AND NEW.percent <> 0 AND (NEW.progress IS NULL OR NEW.progress = 0) THEN
    NEW.progress := NEW.percent;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
